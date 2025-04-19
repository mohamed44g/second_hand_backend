import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// إنشاء بلاغ جديد
export const createReportDb = async (
  reporter_id,
  reported_entity_type,
  reported_entity_id,
  reason
) => {
  const validEntityTypes = ["message", "device", "auction", "user"];
  if (!validEntityTypes.includes(reported_entity_type)) {
    throw new AppError("Invalid entity type", 400);
  }

  const result = await pool.query(
    `INSERT INTO Reports (reporter_id, reported_entity_type, reported_entity_id, reason, status, created_at)
     VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
     RETURNING *`,
    [reporter_id, reported_entity_type, reported_entity_id, reason]
  );
  return result.rows[0];
};

// جلب بلاغات المستخدم
export const getUserReportstDb = async (reporter_id) => {
  const result = await pool.query(
    `SELECT * FROM Reports 
     WHERE reporter_id = $1 
     ORDER BY created_at DESC`,
    [reporter_id]
  );
  return result.rows;
};

// جلب كل البلاغات (للإدارة)
export const getAllReportstDb = async () => {
  const result = await pool.query(
    `SELECT r.*, u.username AS reporter_name 
     FROM Reports r
     JOIN Users u ON r.reporter_id = u.user_id
     ORDER BY r.created_at DESC`
  );
  return result.rows;
};

// تحديث حالة البلاغ
export const updateReportStatustDb = async (report_id, status) => {
  const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
  if (!validStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const result = await pool.query(
    `UPDATE Reports 
     SET status = $1 
     WHERE report_id = $2 
     RETURNING *`,
    [status, report_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Report not found", 404);
  }
  return result.rows[0];
};
