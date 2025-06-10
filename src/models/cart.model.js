// models/cart.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

export const addToCartDb = async (user_id, device_id, quantity) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. التحقق مما إذا كان العنصر موجودًا في السلة
    const checkQuery = `
  SELECT Cart.*, d.seller_id 
  FROM Cart
  JOIN Devices d ON Cart.device_id = d.device_id
  WHERE Cart.user_id = $1 AND Cart.device_id = $2
`;
    const checkResult = await client.query(checkQuery, [user_id, device_id]);

    if (
      checkResult.rows.length > 0 &&
      checkResult.rows[0].seller_id == user_id
    ) {
      // المستخدم يحاول إضافة جهازه الخاص إلى السلة
      await client.query("ROLLBACK");
      throw new AppError("لا يمكنك إضافة جهازك الخاص إلى السلة", 400);
    }
    if (checkResult.rows.length > 0) {
      // العنصر موجود بالفعل
      await client.query("COMMIT");
      throw new AppError("العنصر مضاف بالفعل لا يمكن اضافته مرة اخرى", 400);
    }

    // 2. إضافة العنصر إذا لم يكن موجودًا
    const insertQuery = `
      INSERT INTO Cart (user_id, device_id, quantity)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [
      user_id,
      device_id,
      quantity,
    ]);

    await client.query("COMMIT");
    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// جلب محتويات الكارت لمستخدم معين
export const getCartItemsDb = async (user_id) => {
  const result = await pool.query(
    `SELECT 
       c.*, 
       d.current_price, 
       d.starting_price, 
       d.name, 
       d.device_id, 
       d.seller_id, 
       d.main_category_id, 
       d.subcategory_id,
       u.username AS seller_name,
       (SELECT image_path 
        FROM DeviceImages di 
        WHERE di.device_id = d.device_id 
        ORDER BY di.created_at ASC 
        LIMIT 1) AS image_url
     FROM Cart c
     JOIN Devices d ON c.device_id = d.device_id
     JOIN Users u ON d.seller_id = u.user_id
     WHERE c.user_id = $1`,
    [user_id]
  );
  console.log(result.rows);
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
