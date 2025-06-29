import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// محاكاة __dirname في ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAllDevices = async (filters = {}) => {
  const { mainCategory, subcategory, location, minPrice, maxPrice } = filters;

  let query = `
SELECT 
    d.*,
    CASE 
        WHEN sa.ad_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
    END AS is_Sponsored, 
    sa.end_date AS ad_end_date,
    CONCAT(u.first_name, ' ', u.last_name) AS seller_username,
    u.address AS seller_address,
    mc.main_category_name,
    sc.subcategory_name,
    (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating,
    (SELECT image_path 
     FROM DeviceImages di 
     WHERE di.device_id = d.device_id 
     ORDER BY di.created_at ASC 
     LIMIT 1) AS image_url,
    CASE 
        WHEN d.status = 'accepted' THEN 1 
        WHEN d.status = 'sold' THEN 2 
    END AS status_order
FROM Devices d
JOIN Users u ON d.seller_id = u.user_id
JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
LEFT JOIN SponsoredAds sa 
    ON sa.ad_entity_type = 'device'
    AND sa.ad_entity_id = d.device_id
    AND sa.end_date >= CURRENT_TIMESTAMP
WHERE d.is_auction = false AND d.status = 'accepted' OR d.status = 'sold'
`;
  const values = [];

  if (mainCategory) {
    values.push(mainCategory);
    query += ` AND mc.main_category_name = $${values.length}`;
  }
  if (location) {
    values.push(location);
    query += ` AND u.address ILIKE '%' || $${values.length} || '%'`;
  }
  if (minPrice) {
    values.push(minPrice);
    query += ` AND d.starting_price >= $${values.length}`;
  }
  if (maxPrice) {
    values.push(maxPrice);
    query += ` AND d.starting_price <= $${values.length}`;
  }

  query += `ORDER BY status_order ASC`;

  const result = await pool.query(query, values);
  return result.rows;
};

export const getPendingDevicesDb = async () => {
  const result = await pool.query(
    `SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) AS seller_username, u.address AS seller_address, mc.main_category_name, sc.subcategory_name,
          (SELECT image_path 
       FROM DeviceImages di 
       WHERE di.device_id = d.device_id 
       ORDER BY di.created_at ASC 
       LIMIT 1) AS image_url,
       b.bid_id
     FROM Devices d
     JOIN Users u ON d.seller_id = u.user_id
     LEFT JOIN bids b ON d.device_id = b.device_id
     JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
     JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
     WHERE d.status = 'pending'`
  );
  return result.rows;
};

export const createDevice = async (
  name,
  description,
  main_category_id,
  subcategory_id,
  starting_price,
  current_price,
  seller_id,
  condition,
  manufacturing_year,
  accessories,
  is_auction,
  files
) => {
  const client = await pool.connect();
  const imagePaths = [];
  let fullImagePaths;
  try {
    await client.query("BEGIN");
    const checkActivty = await client.query(
      `SELECT status FROM users WHERE user_id = $1`,
      [seller_id]
    );

    if (checkActivty?.rows[0]?.status !== "active") {
      throw new AppError("حسابك معطل لا يمكنك نشر منتجات الان.", 403);
    }

    const result = await client.query(
      `INSERT INTO Devices (
          name, description, main_category_id, subcategory_id, starting_price, current_price,
          seller_id, condition, manufacturing_year, accessories, is_auction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
      [
        name,
        description,
        main_category_id,
        subcategory_id,
        parseInt(starting_price),
        parseInt(starting_price),
        seller_id,
        condition || null,
        manufacturing_year || null,
        accessories || null,
        is_auction || false,
      ]
    );
    const device = result.rows[0];
    for (const file of files) {
      const relativePath = `uploads/${file.filename}`.replace(/\\/g, "/");
      const query = `
        INSERT INTO DeviceImages (device_id, image_path)
        VALUES ($1, $2)
        RETURNING *;
      `;
      const values = [device.device_id, relativePath];
      const result = await client.query(query, values);
      imagePaths.push(result.rows[0].image_path);
      fullImagePaths = imagePaths.map(
        (path) => `http://localhost:5000/${path}`
      );
    }

    await client.query("COMMIT");
    return { device, fullImagePaths };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating device:", error);
    throw new AppError("حدث خطأ أثناء إنشاء الجهاز", 500);
  } finally {
    if (client) {
      client.release();
    }
  }
};

export const updateDeviceDb = async (deviceId, sellerId, updates, files) => {
  const client = await pool.connect();
  const imagePaths = [];
  let fullImagePaths = [];

  try {
    await client.query("BEGIN");

    // Check if device exists and belongs to seller
    const deviceCheck = await client.query(
      `SELECT * FROM Devices WHERE device_id = $1 AND seller_id = $2`,
      [deviceId, sellerId]
    );

    if (deviceCheck.rows.length === 0) {
      throw new AppError("Device not found or not authorized", 403);
    }

    // Build update query dynamically
    const fields = [];
    const values = [];
    let paramCount = 1;

    const updatableFields = {
      name: updates.name,
      description: updates.description,
      main_category_id: updates.main_category_id,
      subcategory_id: updates.subcategory_id,
      starting_price: updates.starting_price
        ? parseInt(updates.starting_price)
        : undefined,
      current_price: updates.current_price
        ? parseInt(updates.current_price)
        : undefined,
      condition: updates.condition,
      manufacturing_year: updates.manufacturing_year,
      accessories: updates.accessories,
    };

    for (const [key, value] of Object.entries(updatableFields)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    values.push(deviceId);
    const updateQuery = `
      UPDATE Devices
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $${paramCount}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, values);

    // Handle image updates if provided
    if (files && files.length > 0) {
      // Delete existing images
      const existingImages = await client.query(
        `SELECT image_path FROM DeviceImages WHERE device_id = $1`,
        [deviceId]
      );

      for (const image of existingImages.rows) {
        const fullImagePath = path.join(__dirname, "../", image.image_path);
        try {
          fs.unlinkSync(fullImagePath);
        } catch (err) {
          console.error(`Failed to delete image: ${fullImagePath}`, err);
        }
      }

      await client.query(`DELETE FROM DeviceImages WHERE device_id = $1`, [
        deviceId,
      ]);

      // Add new images
      for (const file of files) {
        const relativePath = `uploads/${file.filename}`.replace(/\\/g, "/");
        const query = `
          INSERT INTO DeviceImages (device_id, image_path)
          VALUES ($1, $2)
          RETURNING *;
        `;
        const values = [deviceId, relativePath];
        const result = await client.query(query, values);
        imagePaths.push(result.rows[0].image_path);
      }

      fullImagePaths = imagePaths.map(
        (path) => `http://localhost:5000/${path}`
      );
    }

    // Get updated images
    const imagesResult = await client.query(
      `SELECT image_path FROM DeviceImages WHERE device_id = $1`,
      [deviceId]
    );

    await client.query("COMMIT");

    return {
      device: result.rows[0],
      fullImagePaths: imagesResult.rows.map(
        (img) => `http://localhost:5000/${img.image_path}`
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating device:", error);
    throw new AppError("حدث خطأ أثناء تحديث الجهاز", 500);
  } finally {
    client.release();
  }
};

export const getDeviceByIdDb = async (device_id) => {
  const result = await pool.query(
    `SELECT
        d.*,
        CONCAT(u.first_name, ' ', u.last_name) AS seller_username,
        u.address As seller_address,
        mc.main_category_name,
        sc.subcategory_name,
        (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating
      FROM Devices d
      JOIN Users u ON d.seller_id = u.user_id
      JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
      JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
      WHERE d.device_id = $1 AND d.is_auction = false`,
    [device_id]
  );

  const imagesResult = await pool.query(
    `SELECT image_path FROM DeviceImages WHERE device_id = $1`,
    [device_id]
  );

  if (result.rows.length === 0) {
    throw new AppError("Device not found", 404);
  }
  return { product: result.rows[0], images: imagesResult.rows };
};

export const addMainCategoryDb = async (name) => {
  const result = await pool.query(
    `INSERT INTO MainCategories (main_category_name) VALUES ($1) RETURNING *`,
    [name]
  );
  return result.rows[0];
};

export const addSubcategoryDb = async (name, main_category_id) => {
  const result = await pool.query(
    `INSERT INTO Subcategories (subcategory_name, main_category_id) VALUES ($1, $2) RETURNING *`,
    [name, main_category_id]
  );
  return result.rows[0];
};

export const getCategoriesDb = async () => {
  const mainCategoriesResult = await pool.query("SELECT * FROM MainCategories");
  const subCategoriesResult = await pool.query("SELECT * FROM Subcategories");
  return {
    mainCategories: mainCategoriesResult.rows,
    subCategories: subCategoriesResult.rows,
  };
};

export const getSellerByIdDb = async (seller_id) => {
  const result = await pool.query(`SELECT * FROM Users WHERE user_id = $1`, [
    seller_id,
  ]);
  if (result.rows.length === 0) {
    throw new AppError("Seller not found", 404);
  }
  return result.rows[0];
};

export const getDevicesBySellerIdDb = async (seller_id) => {
  const result = await pool.query(
    `SELECT d.*, 
       b.auction_end_time,
       b.bid_id,
       m.main_category_name, 
       CASE 
         WHEN sa.ad_id IS NOT NULL THEN TRUE 
         ELSE FALSE 
       END AS is_Sponsored, 
       sa.end_date AS ad_end_date,
      (SELECT image_path 
        FROM DeviceImages di 
        WHERE di.device_id = d.device_id 
        ORDER BY di.created_at ASC 
        LIMIT 1) AS image_url
FROM Devices d 
LEFT JOIN bids b ON d.device_id = b.device_id 
JOIN maincategories m ON d.main_category_id = m.main_category_id 
LEFT JOIN SponsoredAds sa 
  ON sa.ad_entity_type = 'device' AND sa.ad_entity_id = d.device_id
  OR sa.ad_entity_type = 'auction' AND sa.ad_entity_id = b.device_id
  AND sa.status = 'active'
  AND sa.start_date <= CURRENT_TIMESTAMP 
  AND sa.end_date >= CURRENT_TIMESTAMP
WHERE d.seller_id = $1;`,
    [seller_id]
  );
  return result.rows;
};

export const getDevicesByCategoryDb = async (category_id) => {
  let query = `
    SELECT 
      d.*,
      CASE 
        WHEN sa.ad_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS is_Sponsored, 
      sa.end_date AS ad_end_date,
      u.username AS seller_username,
      u.address AS seller_address,
      mc.main_category_name,
      sc.subcategory_name,
      d.is_auction,
      a.auction_end_time,
      a.bid_id,
      (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating,
      (SELECT image_path 
       FROM DeviceImages di 
       WHERE di.device_id = d.device_id 
       ORDER BY di.created_at ASC 
       LIMIT 1) AS image_url
    FROM Devices d
    JOIN Users u ON d.seller_id = u.user_id
    LEFT JOIN bids a ON d.device_id = a.device_id
    JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
    JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
    LEFT JOIN SponsoredAds sa 
      ON sa.ad_entity_type = 'device'
      AND sa.ad_entity_id = d.device_id
      AND sa.end_date >= CURRENT_TIMESTAMP
    WHERE d.main_category_id = $1 AND d.status = 'accepted'
  `;
  const result = await pool.query(query, [category_id]);
  return result.rows;
};

export const getDevicesBySubcategoryDb = async (subcategory_id) => {
  let query = `
    SELECT 
      d.*,
      CASE 
        WHEN sa.ad_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS is_Sponsored, 
      sa.end_date AS ad_end_date,
      u.username AS seller_username,
      u.address AS seller_address,
      mc.main_category_name,
      d.is_auction,
      a.auction_end_time,
      a.bid_id,
      sc.subcategory_name,
      (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating,
      (SELECT image_path 
       FROM DeviceImages di 
       WHERE di.device_id = d.device_id 
       ORDER BY di.created_at ASC 
       LIMIT 1) AS image_url
    FROM Devices d
    JOIN Users u ON d.seller_id = u.user_id
    LEFT JOIN bids a ON d.device_id = a.device_id
    JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
    JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
    LEFT JOIN SponsoredAds sa 
      ON sa.ad_entity_type = 'device'
      AND sa.ad_entity_id = d.device_id
      AND sa.end_date >= CURRENT_TIMESTAMP
    WHERE d.subcategory_id = $1 AND d.status = 'accepted'
  `;
  const result = await pool.query(query, [subcategory_id]);
  console.log(result.rows);
  if (result.rows.length === 0) {
    throw new AppError("مفيش منتجات فى الفئة دى", 404);
  }
  return result.rows;
};

export const getLatestDevicesDb = async (limit) => {
  const result = await pool.query(
    `SELECT 
        d.*, 
        c.main_category_name,
        u.username AS seller_username,
        u.address AS seller_address,
        (SELECT image_path 
         FROM DeviceImages di 
         WHERE di.device_id = d.device_id 
         ORDER BY di.created_at ASC 
         LIMIT 1) AS image_url,
        a.*,
        CASE 
         WHEN a.ad_id IS NOT NULL THEN TRUE 
         ELSE FALSE 
       END AS is_Sponsored
     FROM Devices d 
     JOIN MainCategories c ON d.main_category_id = c.main_category_id 
     JOIN Users u ON d.seller_id = u.user_id 
     LEFT JOIN SponsoredAds a 
        ON d.device_id = a.ad_entity_id 
        AND a.end_date >= CURRENT_TIMESTAMP
     WHERE d.is_auction = false and d.status = 'accepted'
     ORDER BY
        CASE WHEN a.ad_id IS NOT NULL THEN 0 ELSE 1 END,
        a.end_date DESC NULLS LAST,
        d.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

//   const result = await pool.query(
//     `SELECT d.*, (SELECT image_path
//         FROM DeviceImages di
//         WHERE di.device_id = d.device_id
//         ORDER BY di.created_at ASC
//         LIMIT 1) AS image_url FROM Devices d WHERE name ILIKE $1`,
//     [`%${search}%`]
//   );
//   return result.rows;
// };
export const getDevicesBySearchDb = async (search) => {
  const result = await pool.query(
    `SELECT 
        d.*, 
        c.main_category_name,
        sc.subcategory_name,
        (SELECT image_path 
         FROM DeviceImages di 
         WHERE di.device_id = d.device_id 
         ORDER BY di.created_at ASC 
         LIMIT 1) AS image_url,
        a.end_date,
        CASE 
          WHEN a.ad_id IS NOT NULL THEN TRUE 
          ELSE FALSE 
        END AS is_Sponsored
     FROM Devices d 
     JOIN MainCategories c ON d.main_category_id = c.main_category_id
     JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
     JOIN Users u ON d.seller_id = u.user_id 
     LEFT JOIN SponsoredAds a 
        ON d.device_id = a.ad_entity_id 
        AND a.end_date >= CURRENT_TIMESTAMP
     WHERE d.name ILIKE $1 OR c.main_category_name ILIKE $1 OR sc.subcategory_name ILIKE $1
     ORDER BY 
        CASE WHEN a.ad_id IS NOT NULL THEN 0 ELSE 1 END,
        a.end_date DESC NULLS LAST,
        d.created_at DESC`,
    [`%${search}%`]
  );
  return result.rows;
};
const saveImageToDb = async (deviceId, imagePath) => {
  try {
    const query = `
      INSERT INTO DeviceImages (device_id, image_path)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const values = [deviceId, imagePath];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    throw new AppError("حدث خطأ أثناء حفظ الصورة في قاعدة البيانات", 500);
  }
};

export const uploadImages = async (deviceId, files) => {
  try {
    const imagePaths = [];
    for (const file of files) {
      // تحويل المسار إلى مسار نسبي
      const relativePath = path
        .join("uploads/devices", file.filename)
        .replace(/\\/g, "/");

      // حفظ الصورة في قاعدة البيانات
      const image = await saveImageToDb(deviceId, relativePath);
      imagePaths.push(image.image_path);
    }
    return imagePaths;
  } catch (error) {
    throw new AppError("حدث خطأ أثناء رفع الصور", 500);
  }
};

export const deleteDeviceDb = async (userId, deviceId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // حذف الصور المرتبطة بالجهاز
    const imagePaths = await client.query(
      "SELECT * FROM DeviceImages WHERE device_id = $1",
      [deviceId]
    );

    const result = await client.query(
      "DELETE FROM Devices WHERE device_id = $1 AND seller_id = $2 RETURNING *",
      [deviceId, userId]
    );
    if (result.rows.length === 0) {
      throw new AppError("غير مسموح", 403);
    }

    for (const imagePath of imagePaths.rows) {
      const fullImagePath = path.join(__dirname, "../", imagePath.image_path);
      console.log(fullImagePath);
      fs.unlinkSync(fullImagePath);
    }

    await client.query("DELETE FROM DeviceImages WHERE device_id = $1", [
      deviceId,
    ]);

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw new AppError("حدث خطأ أثناء حذف الجهاز", 500);
  } finally {
    client.release();
  }
};

export const updateDeviceStatusDb = async (deviceId, status) => {
  if (!["accepted", "rejected", "sold"].includes(status)) {
    throw new AppError("Invalid status", 400);
  }
  const result = await pool.query(
    `UPDATE Devices SET status = $1 WHERE device_id = $2 RETURNING *`,
    [status, deviceId]
  );
  if (result.rows.length === 0) {
    throw new AppError("Device not found", 404);
  }
  return result.rows[0];
};
