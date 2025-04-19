import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// جلب كل المستخدمين للادمن
export const getAllUsersDb = async () => {
  const result = await pool.query(
    `SELECT user_id, username, status,
            CONCAT(first_name, ' ', last_name) AS full_name, 
            email, phone_number, 
            CASE 
              WHEN is_admin = TRUE THEN 'admin'
              WHEN is_seller = TRUE THEN 'seller'
              ELSE 'buyer'
            END AS user_role, 
            created_at
     FROM Users
     ORDER BY created_at DESC`
  );
  return result.rows;
};

// تحديث دور المستخدم للادمن
export const updateUserRoleDb = async (user_id) => {
  const result = await pool.query(
    `UPDATE Users 
     SET is_admin = true 
     WHERE user_id = $1
     RETURNING user_id, username, 
               CONCAT(first_name, ' ', last_name) AS full_name, 
               email, phone_number, 
               CASE 
                 WHEN is_admin = TRUE THEN 'Admin'
                 WHEN is_seller = TRUE THEN 'Seller'
                 ELSE 'Buyer'
               END AS account_type, 
               created_at`,
    [user_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("User not found", 404);
  }
  return result.rows[0];
};

// جلب إحصائيات النظام للادمن
export const getSystemStatsDb = async () => {
  const totalUsers = await pool.query(`SELECT COUNT(*) FROM Users`);
  const totalSellers = await pool.query(
    `SELECT COUNT(*) FROM Users WHERE is_seller = TRUE`
  );
  const totalSales = await pool.query(
    `SELECT COUNT(*) FROM Orders WHERE status = 'delivered'`
  );
  const totalRevenue = await pool.query(
    `SELECT COALESCE(SUM(total_price), 0) FROM Orders WHERE status = 'delivered'`
  );
  const totalAdsRevenue = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) FROM AdPayments`
  );
  const totalProducts = await pool.query(
    `SELECT COUNT(*) FROM Devices WHERE is_auction = FALSE`
  );
  const totalAuctions = await pool.query(`SELECT COUNT(*) FROM Bids`);

  return {
    total_users: parseInt(totalUsers.rows[0].count),
    total_sellers: parseInt(totalSellers.rows[0].count),
    total_sales: parseInt(totalSales.rows[0].count),
    total_revenue: parseFloat(totalRevenue.rows[0].coalesce),
    total_ads_revenue: parseFloat(totalAdsRevenue.rows[0].coalesce),
    total_products: parseInt(totalProducts.rows[0].count),
    total_auctions: parseInt(totalAuctions.rows[0].count),
  };
};
