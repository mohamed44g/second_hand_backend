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
  cancelOrderDb,
} from "../models/orders.model.js";
import { clearCartDb } from "../models/cart.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import { logWalletUsingClientTransaction } from "../models/wallet.model.js";

// دالة للشراء من الكارت (Checkout)
export const checkoutFromCart = AsyncWrapper(async (req, res, next) => {
  const { shipping_address, card_details, with_wallet } = req.body;
  const buyer_id = req.user.userId;

  if (!shipping_address) {
    return next(new AppError("Please provide shipping_address", 400));
  }

  // التحقق من طريقة الدفع
  if (
    !with_wallet &&
    (!card_details ||
      !card_details.card_number ||
      !card_details.expiry_date ||
      !card_details.cvv)
  ) {
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

    // 2. حساب السعر الكلي لجميع العناصر
    let total_price = 0;
    for (const item of cartItems) {
      total_price += +item.price * +item.quantity;
    }

    // 3. إنشاء طلب واحد
    const order = await createOrder(buyer_id, total_price);

    // 4. إضافة عناصر الطلب مع السعر الكامل لكل عنصر
    for (const item of cartItems) {
      const itemTotal = +item.price * +item.quantity;
      await addOrderItem(
        order.order_id,
        item.device_id,
        item.quantity,
        itemTotal,
        item.seller_id
      );

      // تحديث حالة المنتج إلى "sold"
      await client.query(
        "UPDATE Devices SET status = 'sold' WHERE device_id = $1",
        [item.device_id]
      );
    }

    // 5. تسجيل الدفعة بناءً على طريقة الدفع
    let transaction_id;
    if (with_wallet) {
      transaction_id = `WALLET-${order.order_id}-${Date.now()}`;
      await addPayment(
        order.order_id,
        "wallet",
        total_price,
        transaction_id,
        buyer_id
      );

      await logWalletUsingClientTransaction(
        client,
        buyer_id,
        total_price,
        "purchase",
        `شراء أجهزة من الكارت باستخدام المحفظة`
      );
    } else {
      transaction_id = `VISA-${order.order_id}-${Date.now()}`;
      await addPayment(
        order.order_id,
        "visa",
        total_price,
        transaction_id,
        buyer_id
      );

      await logWalletUsingClientTransaction(
        client,
        buyer_id,
        total_price,
        "purchase",
        `شراء أجهزة من الكارت باستخدام الفيزا`
      );
    }

    // 6. إضافة بيانات الشحن
    const shipping_company = "Aramex";
    const tracking_number = `TRK-${order.order_id}-${Date.now()}`;
    await addShipping(
      order.order_id,
      shipping_address,
      shipping_company,
      tracking_number
    );

    // 7. تفريغ الكارت بعد الشراء
    await clearCartDb(buyer_id);

    await client.query("COMMIT");
    Sendresponse(res, 201, "Checkout successful", order);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// دالة للشراء المباشر
export const purchaseDirectly = AsyncWrapper(async (req, res, next) => {
  const {
    device_id,
    quantity = 1,
    shipping_address,
    card_details,
    with_wallet,
  } = req.body;

  const buyer_id = req.user.userId;

  if (!device_id || !quantity || !shipping_address) {
    return next(
      new AppError(
        "Please provide device_id, quantity, and shipping_address",
        400
      )
    );
  }

  if (quantity <= 0) {
    return next(new AppError("Quantity must be greater than 0", 400));
  }

  // التحقق من طريقة الدفع
  if (
    !with_wallet &&
    (!card_details ||
      !card_details.card_number ||
      !card_details.expiry_date ||
      !card_details.cvv)
  ) {
    return next(new AppError("Invalid card details", 400));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. جلب بيانات الجهاز
    const device = await getDeviceById(device_id);
    const seller_id = device.seller_id;
    if (buyer_id === seller_id) {
      return next(new AppError("مينفعش تشترى جهاز انت نزلته.", 400));
    }
    const total_price = +device.starting_price * quantity;

    // 2. إنشاء الطلب
    const order = await createOrder(buyer_id, total_price);

    // 3. إضافة عنصر الطلب
    await addOrderItem(
      order.order_id,
      device_id,
      quantity,
      total_price,
      seller_id
    );

    // تحديث حالة المنتج إلى "sold"
    await client.query(
      "UPDATE Devices SET status = 'sold' WHERE device_id = $1",
      [device_id]
    );

    // 4. تسجيل الدفعة بناءً على طريقة الدفع
    let transaction_id;
    if (with_wallet) {
      transaction_id = `WALLET-${order.order_id}-${Date.now()}`;
      await addPayment(
        order.order_id,
        "wallet",
        total_price,
        transaction_id,
        buyer_id
      );

      await logWalletUsingClientTransaction(
        client,
        buyer_id,
        total_price,
        "purchase",
        `شراء جهاز ${device.name} باستخدام المحفظة`
      );
    } else {
      transaction_id = `VISA-${order.order_id}-${Date.now()}`;
      await addPayment(
        order.order_id,
        "visa",
        total_price,
        transaction_id,
        buyer_id
      );

      await logWalletUsingClientTransaction(
        client,
        buyer_id,
        total_price,
        "purchase",
        `شراء جهاز ${device.name} باستخدام الفيزا`
      );
    }

    // 5. إضافة بيانات الشحن
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

// دالة لإلغاء الطلب (للأدمن)
export const cancelOrder = AsyncWrapper(async (req, res, next) => {
  const { order_id } = req.params;
  const { userId, is_admin } = req.user;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cancelledOrder = await cancelOrderDb(
      client,
      order_id,
      userId,
      is_admin
    );
    await client.query("COMMIT");
    Sendresponse(res, 200, "Order cancelled successfully", cancelledOrder);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
