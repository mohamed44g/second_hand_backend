import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { logWalletUsingClientTransaction } from "./wallet.model.js";

// دالة لإنشاء طلب جديد
export const createOrder = async (buyer_id, total_price) => {
  const result = await pool.query(
    `INSERT INTO Orders (buyer_id, total_price, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [buyer_id, total_price]
  );
  return result.rows[0];
};

// دالة لإضافة عنصر للطلب
export const addOrderItem = async (
  order_id,
  device_id,
  quantity,
  price,
  seller_id
) => {
  const result = await pool.query(
    `INSERT INTO OrderItems (order_id, device_id, quantity, price, seller_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [order_id, device_id, quantity, price, seller_id]
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
    `SELECT c.*, d.starting_price AS price, d.name, d.seller_id AS seller_id
     FROM Cart c
     JOIN Devices d ON c.device_id = d.device_id
     WHERE c.user_id = $1`,
    [user_id]
  );
  return result.rows;
};

// دالة لجلب طلبات المستخدم
export const getUserOrdersDb = async (user_id) => {
  const result = await pool.query(
    `SELECT o.*, 
            oi.seller_id, u.username AS seller_name,
            oi.device_id, oi.quantity, oi.price AS item_price,
            d.name AS device_name,
            p.payment_method, p.amount AS payment_amount, p.transaction_id,
            s.shipping_address, s.shipping_company, s.tracking_number, s.shipped_at,
            di.image_path AS image_url
       FROM Orders o
       LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
       LEFT JOIN Users u ON oi.seller_id = u.user_id
       LEFT JOIN Devices d ON oi.device_id = d.device_id
       LEFT JOIN OrderPayments p ON o.order_id = p.order_id
       LEFT JOIN Shipping s ON o.order_id = s.order_id
       LEFT JOIN deviceimages di ON oi.device_id = di.device_id
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
            oi.price AS item_price, 
            o.total_price, 
            o.order_date, 
            o.status
     FROM Orders o
     JOIN OrderItems oi ON o.order_id = oi.order_id
     JOIN Users buyer ON o.buyer_id = buyer.user_id
     JOIN Users seller ON oi.seller_id = seller.user_id
     JOIN Devices d ON oi.device_id = d.device_id
     ORDER BY o.order_date DESC`
  );
  return result.rows;
};

// تحديث حالة الطلب للأدمن
export const updateOrderStatusDb = async (order_id, status) => {
  const validStatuses = ["processing", "shipped", "delivered"];
  if (!validStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // التحقق من حالة الطلب الحالية
    const order_status = await client.query(
      `SELECT status FROM Orders WHERE order_id = $1`,
      [order_id]
    );

    if (order_status.rows.length === 0) {
      throw new AppError("Order not found", 404);
    }

    if (order_status.rows[0].status === "delivered") {
      throw new AppError("تم تسليم هذا الطلب من قبل", 400);
    }

    if (status === "delivered") {
      // جلب بيانات عناصر الطلب
      const order_result = await client.query(
        `SELECT oi.order_item_id, oi.price AS device_price, oi.seller_id, d.name AS device_name
         FROM OrderItems oi
         JOIN Devices d ON oi.device_id = d.device_id
         WHERE oi.order_id = $1`,
        [order_id]
      );

      for (const item of order_result.rows) {
        const total_price = parseFloat(item.device_price);
        const seller_id = item.seller_id;
        const device_name = item.device_name;

        // حساب رسوم الموقع
        let siteFee = 0.1 * total_price;
        const seller_share = total_price - siteFee;

        // تحويل المبلغ إلى رصيد البائع القابل للسحب
        await client.query(
          `UPDATE Users SET wallet_balance = wallet_balance + $1 WHERE user_id = $2`,
          [seller_share, seller_id]
        );

        // تسجيل معاملة البائع
        await logWalletUsingClientTransaction(
          client,
          seller_id,
          seller_share,
          "sale",
          `بيع ${device_name} تم تسليمه بنجاح بعد خصم رسوم الموقع ${siteFee} ج.م`
        );

        // تسجيل رسوم الموقع في SiteWallet
        await client.query(
          `INSERT INTO SiteWallet (amount, transaction_type, description)
           VALUES ($1, $2, $3)`,
          [
            siteFee,
            "credit",
            `Site fee for seller ${seller_id} in order ${order_id}`,
          ]
        );
      }
    }

    // تحديث حالة الطلب
    const result = await client.query(
      `UPDATE Orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE order_id = $2 AND status != 'delivered' AND status != 'cancelled'
       RETURNING *`,
      [status, order_id]
    );

    if (result.rowCount === 0) {
      throw new AppError("Order cannot be updated", 400);
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// دالة لإلغاء الطلب
export const cancelOrderDb = async (client, order_id, user_id, is_admin) => {
  // التحقق من حالة الطلب
  const order_result = await client.query(
    `SELECT o.*, p.amount AS payment_amount
     FROM Orders o
     JOIN OrderPayments p ON o.order_id = p.order_id
     WHERE o.order_id = $1`,
    [order_id]
  );

  if (order_result.rows.length === 0) {
    throw new AppError("Order not found", 404);
  }

  const order = order_result.rows[0];

  if (order.status === "delivered") {
    throw new AppError("Cannot cancel a delivered order", 400);
  }

  if (!is_admin) {
    throw new AppError("You are not authorized to cancel this order", 403);
  }

  // إرجاع المبلغ إلى محفظة المشتري
  const refund_amount = parseFloat(order.payment_amount);
  await client.query(
    `UPDATE Users SET wallet_balance = wallet_balance + $1 WHERE user_id = $2`,
    [refund_amount, order.buyer_id]
  );

  // تسجيل معاملة الإرجاع
  await logWalletUsingClientTransaction(
    client,
    order.buyer_id,
    refund_amount,
    "deposit",
    `ارجاع مبلغ الاوردر رقم ${order_id}`
  );

  // تحديث حالة الأجهزة إلى available
  await client.query(
    `UPDATE Devices d
     SET status = 'accepted'
     WHERE d.device_id IN (
       SELECT device_id FROM OrderItems WHERE order_id = $1
     )`,
    [order_id]
  );

  // تحديث حالة الطلب إلى cancelled
  await client.query(
    `DELETE FROM Orders 
         WHERE order_id = $1 AND status != 'delivered'`,
    [order_id]
  );

  await client.query(
    `DELETE FROM OrderItems 
         WHERE order_id = $1`,
    [order_id]
  );

  await client.query(
    `DELETE FROM OrderPayments 
         WHERE order_id = $1`,
    [order_id]
  );

  await client.query(
    `DELETE FROM Shipping 
         WHERE order_id = $1`,
    [order_id]
  );

  return order;
};
