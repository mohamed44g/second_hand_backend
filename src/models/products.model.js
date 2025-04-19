import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

export const getAllDevices = async (filters = {}) => {
  const { mainCategory, subcategory, location, minPrice, maxPrice } = filters;

  console.log("Filters:", filters);
  let query = `
      SELECT 
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
      WHERE 1=1 AND d.is_auction = false
    `;
  const values = [];

  if (mainCategory) {
    values.push(mainCategory);
    query += ` AND mc.main_category_name = $${values.length}`;
  }
  if (location) {
    values.push(location);
    query += ` AND u.address LIKE '%' || $${values.length} || '%'`;
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
  image_url,
  condition,
  manufacturing_year,
  accessories,
  is_auction
) => {
  const result = await pool.query(
    `INSERT INTO Devices (
        name, description, main_category_id, subcategory_id, starting_price, current_price,
        seller_id, image_url, condition, manufacturing_year, accessories, is_auction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
    [
      name,
      description,
      main_category_id,
      subcategory_id,
      parseInt(starting_price),
      parseInt(current_price),
      seller_id,
      image_url || null,
      condition || null,
      manufacturing_year || null,
      accessories || null,
      is_auction || false,
    ]
  );
  return result.rows[0];
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

  if (result.rows.length === 0) {
    throw new AppError("Device not found", 404);
  }
  return result.rows[0];
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
    `SELECT d.*, b.auction_end_time, m.main_category_name FROM Devices d LEFT JOIN bids b ON d.device_id = b.device_id JOIN maincategories m ON d.main_category_id = m.main_category_id WHERE seller_id = $1`,
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
