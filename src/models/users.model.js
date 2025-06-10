import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";
export const userCheck = async (username, email) => {
  const user = await pool.query(
    "SELECT * FROM Users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (userCheck.rows?.length > 0) {
    throw new AppError("User already exists", 400);
  }
  return user.rows[0];
};

export const userCreate = async (
  username,
  email,
  password,
  first_name,
  last_name,
  phone_number,
  address,
  identity_image,
  is_seller
) => {
  const user = await pool.query(
    `INSERT INTO Users (username, email, password, first_name, last_name, phone_number, address,identity_image, is_seller)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
    [
      username,
      email,
      password,
      first_name,
      last_name,
      phone_number || null,
      address || null,
      identity_image,
      is_seller || false,
    ]
  );

  return user;
};

export const userDelete = async (user_id, is_admin, deletedAccountId) => {
  const userCheck = await pool.query(
    `SELECT user_id, is_admin FROM users WHERE user_id = $1`,
    [user_id]
  );


  if (userCheck.rows[0].user_id != user_id && !is_admin) {
    throw new AppError("لا يوجد صلاحية لديك لحذف الحساب.", 403);
  }
  const user = await pool.query(
    "DELETE FROM Users WHERE user_id = $1 AND is_admin != 'true'",
    [deletedAccountId]
  );
  return user.rowCount;
};

export const updateUserDb = async (
  user_id,
  username,
  email,
  first_name,
  last_name,
  phone_number,
  address
) => {
  const user = await pool.query(
    `UPDATE Users SET username = $1, email = $2, first_name = $3, last_name = $4, phone_number = $5, address = $6 WHERE user_id = $7 RETURNING *`,
    [username, email, first_name, last_name, phone_number, address, user_id]
  );
  return user.rows[0];
};

export const changeUserPasswordDb = async (user_id, password) => {
  const user = await pool.query(
    `UPDATE Users SET password = $1 WHERE user_id = $2 RETURNING *`,
    [password, user_id]
  );
  return user.rowCount;
};

export const getUserByIdDb = async (user_id) => {
  const user = await pool.query(
    "SELECT username, password, first_name, last_name, phone_number, address, identity_image, is_seller, is_admin, created_at, status, email FROM Users WHERE user_id = $1",
    [user_id]
  );
  return user.rows[0];
};

// جلب كل التجار للادمن
export const getAllSellersDb = async () => {
  const result = await pool.query(
    `SELECT u.user_id, u.username, 
            CONCAT(u.first_name, ' ', u.last_name) AS full_name, 
            u.email, 
            (SELECT AVG(rating)::FLOAT FROM seller_reviews sr WHERE sr.seller_id = u.user_id) AS rating, 
            (SELECT COUNT(*) FROM Orders o WHERE o.seller_id = u.user_id AND o.status = 'delivered') AS total_sales, 
            (SELECT COALESCE(SUM(o.total_price), 0) FROM Orders o WHERE o.seller_id = u.user_id AND o.status = 'delivered') AS revenue
     FROM Users u
     WHERE u.is_seller = TRUE
     ORDER BY u.created_at DESC`
  );
  return result.rows.map((seller) => ({
    ...seller,
    rating: seller.rating ? parseFloat(seller.rating.toFixed(1)) : null,
  }));
};

// حذف تاجر للادمن
export const deleteSellerDb = async (user_id) => {
  const result = await pool.query(
    `DELETE FROM Users
     WHERE user_id = $1 AND is_seller = TRUE CASCADE;`,
    [user_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Seller not found", 404);
  }
  return result.rows[0];
};

// تحديث حالة حساب التاجر (تعطيل) للادمن
export const disableAccountDb = async (user_id) => {
  const result = await pool.query(
    `UPDATE Users
     SET status = 'inactive'
     WHERE user_id = $1`,
    [user_id]
  );
  if (result.rowCount === 0) {
    throw new AppError("Seller not found or already inactive", 404);
  }
  return result.rows[0];
};

// تحديث حالة حساب التاجر (تفعيل) للادمن
export const enableAccountDb = async (user_id) => {
  const result = await pool.query(
    `UPDATE Users
     SET status = 'active'
     WHERE user_id = $1`,
    [user_id]
  );
  if (result.rowCount === 0) {
    throw new AppError("Seller not found or already active", 404);
  }
  return result.rows[0];
};

export const changeUserRoleDb = async (seller, user_id) => {
  let result;
  if (seller) {
    result = await pool.query(
      `UPDATE Users
     SET is_seller = true
     WHERE user_id = $1`,
      [user_id]
    );
  } else {
    result = await pool.query(
      `UPDATE Users
     SET is_seller = false
     WHERE user_id = $1`,
      [user_id]
    );
  }

  if (result.rowCount === 0) {
    throw new AppError("حدث خطا اثناء تحديث المستخدم", 404);
  }
  return result.rows[0];
};
