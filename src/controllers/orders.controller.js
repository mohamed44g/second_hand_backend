// controllers/orders.controllers.js
import { pool } from "../config/db.js";
import {
  createOrder,
  addOrderItem,
  addPayment,
  addShipping,
  updateOrderStatusDb,
  getDeviceById,
  getCartItemsWithDetails,
  getUserOrdersDb,
  getAllOrdersDb,
} from "../models/orders.model.js";
import { clearCartDb } from "../models/cart.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import {
  logWalletUsingClientTransaction,
  updatePendingBalanceDb,
} from "../models/wallet.model.js";

// دالة للشراء من الكارت (Checkout)
export const checkoutFromCart = AsyncWrapper(async (req, res, next) => {
  const { shipping_address, card_details } = req.body;
  const buyer_id = req.user.userId;

  if (!shipping_address || !card_details) {
    return next(
      new AppError("Please provide shipping_address and card_details", 400)
    );
  }

  const { card_number, expiry_date, cvv } = card_details;
  if (!card_number || !expiry_date || !cvv) {
    return next(new AppError("Invalid card details", 400));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. جلب محتويات الكارت مع تفاصيل الأجهزة
    const cartItems = await getCartItemsWithDetails(buyer_id);
    if (cartItems.length === 0) {
      throw new AppError("Your cart is empty", 400);
    }

    // 2. تجميع المنتجات حسب البائع وحساب السعر الكلي
    const ordersBySeller = {};
    for (const item of cartItems) {
      const seller_id = item.seller_id;
      const itemTotal = item.price * item.quantity;

      if (!ordersBySeller[seller_id]) {
        ordersBySeller[seller_id] = { items: [], total: 0 };
      }
      ordersBySeller[seller_id].items.push({
        device_id: item.device_id,
        quantity: item.quantity,
      });
      ordersBySeller[seller_id].total += itemTotal;
    }

    // 3. إنشاء طلبات منفصلة لكل بائع
    const createdOrders = [];
    for (const seller_id in ordersBySeller) {
      const { items, total } = ordersBySeller[seller_id];

      // إنشاء الطلب
      const order = await createOrder(buyer_id, parseInt(seller_id), total);
      createdOrders.push(order);

      // إضافة عناصر الطلب
      for (const item of items) {
        await addOrderItem(order.order_id, item.device_id, item.quantity);
      }

      // تسجيل الدفعة
      const transaction_id = `VISA-${order.order_id}-${Date.now()}`;
      await addPayment(order.order_id, "visa", total, transaction_id);

      // إضافة بيانات الشحن
      const shipping_company = "Aramex";
      const tracking_number = `TRK-${order.order_id}-${Date.now()}`;
      await addShipping(
        order.order_id,
        shipping_address,
        shipping_company,
        tracking_number
      );

      // تحديث حالة الطلب
      await updateOrderStatus(order.order_id, "processing");
    }

    // 4. تفريغ الكارت بعد الشراء
    await clearCartDb(buyer_id);

    await client.query("COMMIT");
    Sendresponse(res, 201, "Checkout successful", createdOrders);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// دالة للشراء المباشر
export const purchaseDirectly = AsyncWrapper(async (req, res, next) => {
  const { device_id, quantity = 1, shipping_address, card_details } = req.body;
  const buyer_id = req.user.userId;

  if (!device_id || !quantity || !shipping_address || !card_details) {
    return next(
      new AppError(
        "Please provide device_id, quantity, shipping_address, and card_details",
        400
      )
    );
  }

  if (quantity <= 0) {
    return next(new AppError("Quantity must be greater than 0", 400));
  }

  const { card_number, expiry_date, cvv } = card_details;
  if (!card_number || !expiry_date || !cvv) {
    return next(new AppError("Invalid card details", 400));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. جلب بيانات الجهاز
    const device = await getDeviceById(device_id);
    const seller_id = device.seller_id;
    const total_price = +device.starting_price * quantity;

    const siteFee = 0.05 * total_price; // 5% من السعر الكلي

    // 2. إنشاء الطلب
    const order = await createOrder(buyer_id, seller_id, total_price);

    // 3. إضافة عنصر الطلب
    await addOrderItem(order.order_id, device_id, quantity);

    // 4. اضافة المبلغ لرصيد البائع وتسجيله فى سجل المعاملات
    await updatePendingBalanceDb(client, seller_id, +total_price);

    // 5. اضافة المبلغ الى سجل المعاملات لدى البائع
    await logWalletUsingClientTransaction(
      client,
      seller_id,
      total_price,
      "deposit",
      `رصيد معلق من بيع ${device.name}`
    );

    // 6. تسجيل الدفعة
    const transaction_id = `VISA-${order.order_id}-${Date.now()}`;
    await addPayment(
      order.order_id,
      "visa",
      total_price,
      transaction_id,
      buyer_id
    );

    // 7. إضافة بيانات الشحن
    const shipping_company = "second-hand";
    const tracking_number = `TRK-${order.order_id}-${Date.now()}`;
    await addShipping(
      order.order_id,
      shipping_address,
      shipping_company,
      tracking_number
    );

    await client.query("COMMIT");
    Sendresponse(res, 201, "Purchase successful", order);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// دالة لجلب طلبات المستخدم
export const getUserOrders = AsyncWrapper(async (req, res, next) => {
  const user_id = req.user.userId;
  const orders = await getUserOrdersDb(user_id);
  if (orders.length === 0) {
    return Sendresponse(res, 200, "No orders found for this user", []);
  }
  Sendresponse(res, 200, "User orders fetched successfully", orders);
});

// دالة لجلب كل الطلبات (للأدمن)
export const getAllOrders = AsyncWrapper(async (req, res, next) => {
  const orders = await getAllOrdersDb();
  if (orders.length === 0) {
    return Sendresponse(res, 200, "No orders found in the system", []);
  }
  Sendresponse(res, 200, "All orders fetched successfully", orders);
});

// دالة لتحديث حالة الطلب (للأدمن)
export const updateOrderStatus = AsyncWrapper(async (req, res, next) => {
  const { order_id } = req.params;
  const { status } = req.body;

  if (!status) {
    return next(new AppError("Please provide a new status for the order", 400));
  }

  const updatedOrder = await updateOrderStatusDb(order_id, status);
  Sendresponse(res, 200, "Order status updated successfully", updatedOrder);
});
