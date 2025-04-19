import { pool } from "../config/db.js";

export const getReviewsByDeviceId = async (device_id) => {
  const result = await pool.query(
    `SELECT r.*, u.username, u.email
       FROM reviews r
       JOIN Users u ON r.user_id = u.user_id
       WHERE r.device_id = $1`,
    [device_id]
  );
  return result.rows;
};
export const createDeviceReview = async (
  device_id,
  user_id,
  rating,
  comment
) => {
  const result = await pool.query(
    `INSERT INTO reviews (device_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
    [device_id, user_id, rating, comment || null]
  );
  return result.rows[0];
};

export const getSellerReviewsBySellerId = async (seller_id) => {
  const result = await pool.query(
    `SELECT sr.*, u.username, u.email
       FROM seller_reviews sr
       JOIN Users u ON sr.user_id = u.user_id
       WHERE sr.seller_id = $1`,
    [seller_id]
  );
  return result.rows;
};

export const createSellerReview = async (
  seller_id,
  user_id,
  rating,
  comment
) => {
  const result = await pool.query(
    `INSERT INTO seller_reviews (seller_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
    [seller_id, user_id, rating, comment || null]
  );
  return result.rows[0];
};
