// models/orders.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// دالة لإنشاء طلب جديد
export const createOrder = async (buyer_id, seller_id, total_price) => {
  const result = await pool.query(
    `INSERT INTO Orders (buyer_id, seller_id, total_price, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [buyer_id, seller_id, total_price]
  );
  return result.rows[0];
};

// دالة لإضافة عنصر للطلب
export const addOrderItem = async (order_id, device_id, quantity) => {
  const result = await pool.query(
    `INSERT INTO OrderItems (order_id, device_id, quantity)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [order_id, device_id, quantity]
  );
  return result.rows[0];
};

// دالة لإضافة دفعة
export const addPayment = async (
  order_id,
  payment_method,
  amount,
  transaction_id,
  buyer_id
) => {
  const result = await pool.query(
    `INSERT INTO OrderPayments (order_id, payment_method, amount, transaction_id, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [order_id, payment_method, amount, transaction_id, buyer_id]
  );
  return result.rows[0];
};

// دالة لإضافة دفعة للإعلانات الممولة
export const addAdsPayment = async (
  ad_id,
  payment_method,
  amount,
  transaction_id,
  buyer_id
) => {
  const result = await pool.query(
    `INSERT INTO AdPayments (ad_id, payment_method, amount, transaction_id, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ad_id, payment_method, amount, transaction_id, buyer_id]
  );
  return result.rows[0];
};

// دالة لإضافة بيانات الشحن
export const addShipping = async (
  order_id,
  shipping_address,
  shipping_company,
  tracking_number
) => {
  const result = await pool.query(
    `INSERT INTO Shipping (order_id, shipping_address, shipping_company, tracking_number, shipped_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     RETURNING *`,
    [order_id, shipping_address, shipping_company, tracking_number]
  );
  return result.rows[0];
};

// دالة لجلب بيانات الجهاز مع معرف البائع
export const getDeviceById = async (device_id) => {
  const result = await pool.query(
    `SELECT d.*, u.user_id AS seller_id
     FROM Devices d
     JOIN Users u ON d.seller_id = u.user_id
     WHERE device_id = $1`,
    [device_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Device not found", 404);
  }
  return result.rows[0];
};

// دالة لجلب أسعار الأجهزة من الكارت
export const getCartItemsWithDetails = async (user_id) => {
  const result = await pool.query(
    `SELECT c.*, d.starting_price, d.name, u.user_id AS seller_id
     FROM Cart c
     JOIN Devices d ON c.device_id = d.device_id
     JOIN Users u ON c.user_id = u.user_id
     WHERE c.user_id = $1`,
    [user_id]
  );
  return result.rows;
};

export const getUserOrdersDb = async (user_id) => {
  const result = await pool.query(
    `SELECT o.*, u.username AS seller_name,
              d.image_url,
              oi.device_id, oi.quantity,
              d.name,
              p.payment_method, p.amount AS payment_amount, p.transaction_id,
              s.shipping_address, s.shipping_company, s.tracking_number, s.shipped_at
       FROM Orders o
       JOIN Users u ON o.seller_id = u.user_id
       LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
       LEFT JOIN Devices d ON oi.device_id = d.device_id
       LEFT JOIN OrderPayments p ON o.order_id = p.order_id
       LEFT JOIN Shipping s ON o.order_id = s.order_id
       WHERE o.buyer_id = $1
       ORDER BY o.order_date DESC`,
    [user_id]
  );
  return result.rows;
};

// دالة لجلب كل الطلبات في النظام (للأدمن)
export const getAllOrdersDb = async () => {
  const result = await pool.query(
    `SELECT o.order_id, 
            buyer.username AS buyer, 
            seller.username AS seller, 
            d.name AS product, 
            o.total_price, 
            o.order_date, 
            o.status
     FROM Orders o
     JOIN Users buyer ON o.buyer_id = buyer.user_id
     JOIN Users seller ON o.seller_id = seller.user_id
     JOIN OrderItems oi ON o.order_id = oi.order_id
     JOIN Devices d ON oi.device_id = d.device_id
     ORDER BY o.order_date DESC`
  );
  return result.rows;
};

// تحديث حالة الطلب للادمن
export const updateOrderStatusDb = async (order_id, status) => {
  const validStatuses = ["processing", "shipped", "delivered"];
  if (!validStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const result = await pool.query(
    `UPDATE Orders 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE order_id = $2`,
    [status, order_id]
  );
  return result.rowCount;
};
