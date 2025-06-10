// models/chat.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// إنشاء شات جديد بين مستخدمين
export const createChatDb = async (user_id_1, user_id_2) => {
  // تحقق إذا كان الشات موجود بالفعل
  const existingChat = await pool.query(
    `SELECT * FROM Chats 
     WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)`,
    [user_id_1, user_id_2]
  );

  if (existingChat.rows.length > 0) {
    return existingChat.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO Chats (user_id_1, user_id_2, created_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     RETURNING *`,
    [user_id_1, user_id_2]
  );
  return result.rows[0];
};

// جلب كل الشاتات بتاعة مستخدم معين
export const getUserChatsDb = async (user_id) => {
  const result = await pool.query(
    `SELECT c.chat_id, c.created_at,
              CASE 
                WHEN c.user_id_1 = $1 THEN u2.username 
                ELSE u1.username 
              END AS other_user_name,
              (SELECT m.message_text 
               FROM Messages m 
               WHERE m.chat_id = c.chat_id 
               ORDER BY m.timestamp DESC 
               LIMIT 1) AS last_message,
              (SELECT m.timestamp 
               FROM Messages m 
               WHERE m.chat_id = c.chat_id 
               ORDER BY m.timestamp DESC 
               LIMIT 1) AS last_message_timestamp
       FROM Chats c
       JOIN Users u1 ON c.user_id_1 = u1.user_id
       JOIN Users u2 ON c.user_id_2 = u2.user_id
       WHERE c.user_id_1 = $1 OR c.user_id_2 = $1`,
    [user_id]
  );
  return result.rows;
};

// جلب رسائل شات معين
export const getChatMessagesDb = async (chat_id, user_id, is_admin) => {
  // تحقق من وجود الشات
  const chatCheck = await pool.query(
    `SELECT * FROM Chats WHERE chat_id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
    [chat_id, user_id]
  );
  if (chatCheck.rows.length === 0 && !is_admin) {
    throw new AppError("انت لا تمتلك صلاحة الدخول لهذا الشات.", 403);
  }
  const result = await pool.query(
    `SELECT m.*, u.username AS sender_name 
     FROM Messages m
     JOIN Users u ON m.sender_id = u.user_id
     WHERE m.chat_id = $1
     ORDER BY m.timestamp ASC`,
    [chat_id]
  );
  return result.rows;
};

// جلب بيانات الشات
export const getChatDetailsDb = async (chat_id, current_user_id, is_admin) => {
  // تحقق من وجود الشات
  const chatCheck = await pool.query(
    `SELECT * FROM Chats WHERE chat_id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
    [chat_id, current_user_id]
  );
  if (chatCheck.rows.length === 0 && !is_admin) {
    throw new AppError("انت لا تمتلك صلاحة الدخول لهذا الشات.", 403);
  }

  const result = await pool.query(
    `SELECT c.*, 
            CASE 
              WHEN c.user_id_1 = $2 THEN u2.username 
              ELSE u1.username 
            END AS other_user_name
     FROM Chats c
     JOIN Users u1 ON c.user_id_1 = u1.user_id
     JOIN Users u2 ON c.user_id_2 = u2.user_id
     WHERE c.chat_id = $1`,
    [chat_id, current_user_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Chat not found", 404);
  }
  return result.rows[0];
};
