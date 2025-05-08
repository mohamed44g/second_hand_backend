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
        u.username AS seller_username,
        u.address As seller_address,
        mc.main_category_name,
        sc.subcategory_name,
        (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating,
        (SELECT image_path 
        FROM DeviceImages di 
        WHERE di.device_id = d.device_id 
        ORDER BY di.created_at ASC 
        LIMIT 1) AS image_url
      FROM Devices d
      JOIN Users u ON d.seller_id = u.user_id
      JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
      JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
      LEFT JOIN SponsoredAds sa 
  ON sa.ad_entity_type = 'device'
  AND sa.ad_entity_id = d.device_id
  AND sa.start_date <= CURRENT_TIMESTAMP 
  AND sa.end_date >= CURRENT_TIMESTAMP
      WHERE 1=1 AND d.is_auction = false
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

  query += ` ORDER BY d.created_at DESC`;

  const result = await pool.query(query, values);
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

export const getDeviceByIdDb = async (device_id) => {
  const result = await pool.query(
    `SELECT
        d.*,
        u.username AS seller_username,
        u.address As seller_address,
        mc.main_category_name,
        sc.subcategory_name,
        (SELECT AVG(r.rating) FROM Reviews r WHERE r.device_id = d.device_id) AS rating
      FROM Devices d
      JOIN Users u ON d.seller_id = u.user_id
      JOIN MainCategories mc ON d.main_category_id = mc.main_category_id
      JOIN Subcategories sc ON d.subcategory_id = sc.subcategory_id
      WHERE d.device_id = $1`,
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
  OR sa.ad_entity_type = 'auction' AND sa.ad_entity_id = b.bid_id
  AND sa.status = 'active'
  AND sa.start_date <= CURRENT_TIMESTAMP 
  AND sa.end_date >= CURRENT_TIMESTAMP
WHERE d.seller_id = $1;`,
    [seller_id]
  );
  return result.rows;
};

export const getDevicesByCategoryDb = async (category_id) => {
  const result = await pool.query(
    `SELECT * FROM Devices WHERE main_category_id = $1`,
    [category_id]
  );
  return result.rows;
};

export const getDevicesBySubcategoryDb = async (subcategory_id) => {
  const result = await pool.query(
    `SELECT * FROM Devices WHERE subcategory_id = $1`,
    [subcategory_id]
  );
  return result.rows;
};

export const getLatestDevicesDb = async (limit) => {
  const result = await pool.query(
    `SELECT * FROM Devices ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

export const getDevicesBySearchDb = async (search) => {
  const result = await pool.query(`SELECT * FROM Devices WHERE name ILIKE $1`, [
    `%${search}%`,
  ]);
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
