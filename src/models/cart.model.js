// models/cart.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// إضافة منتج للكارت
export const addToCartDb = async (user_id, device_id, quantity) => {
  const result = await pool.query(
    `INSERT INTO Cart (user_id, device_id, quantity)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [user_id, device_id, quantity]
  );
  return result.rows[0];
};

// جلب محتويات الكارت لمستخدم معين
export const getCartItemsDb = async (user_id) => {
  const result = await pool.query(
    `SELECT c.*, d.current_price, d.starting_price, d.name, d.image_url
     FROM Cart c
     JOIN Devices d ON c.device_id = d.device_id
     WHERE c.user_id = $1`,
    [user_id]
  );
  return result.rows;
};

// حذف عنصر من الكارت
export const removeFromCartDb = async (user_id, device_id) => {
  const result = await pool.query(
    `DELETE FROM Cart WHERE user_id = $1 AND device_id = $2 RETURNING *`,
    [user_id, device_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Item not found in cart", 404);
  }
  return result.rows[0];
};

// تفريغ الكارت بعد الشراء
export const clearCartDb = async (user_id) => {
  await pool.query(`DELETE FROM Cart WHERE user_id = $1`, [user_id]);
};
