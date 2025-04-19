import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// wallet
export const getWalletDb = async (user_id) => {
  const wallet = await pool.query(
    "SELECT wallet_balance, pending_balance FROM Users WHERE user_id = $1",
    [user_id]
  );
  if (wallet.rows.length === 0) {
    throw new AppError("Wallet not found", 404);
  }
  return wallet.rows[0];
};

export const addToWalletDb = async (user_id, amount) => {
  const wallet = await pool.query(
    "UPDATE Users SET wallet_balance = wallet_balance + $1 WHERE user_id = $2 RETURNING *",
    [amount, user_id]
  );
  if (wallet.rows.length === 0) {
    throw new AppError("Wallet not found", 404);
  }

  await logWalletTransaction(user_id, amount, "deposit", "ايداع رصيد");
  return wallet.rows[0];
};

export const withdrawFromWalletDb = async (user_id, amount) => {
  const wallet = await pool.query(
    "UPDATE Users SET wallet_balance = wallet_balance - $1 WHERE user_id = $2 RETURNING *",
    [amount, user_id]
  );
  if (wallet.rows.length === 0) {
    throw new AppError("Wallet not found", 404);
  }

  await logWalletTransaction(user_id, amount, "withdraw", "سحب رصيد");
  return wallet.rows[0];
};

export const logWalletTransaction = async (
  user_id,
  amount,
  transaction_type,
  description = null
) => {
  const result = await pool.query(
    `INSERT INTO wallet_history (user_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
    [user_id, amount, transaction_type, description]
  );
  return result.rows[0];
};

// دالة لجلب سجل العمليات لمستخدم معين
export const getWalletHistoryDb = async (user_id) => {
  const result = await pool.query(
    `SELECT * FROM wallet_history WHERE user_id = $1 ORDER BY created_at DESC`,
    [user_id]
  );
  return result.rows;
};
