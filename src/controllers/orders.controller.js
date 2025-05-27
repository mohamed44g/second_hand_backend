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

    // 2. حساب السعر الكلي لجميع العناصر وتجميع بيانات البائعين
    let total_price = 0;
    const sellerBalances = {}; // لتتبع المبالغ والأجهزة لكل بائع
    for (const item of cartItems) {
      const itemTotal = +item.price * +item.quantity;
      total_price += itemTotal;
      if (!sellerBalances[item.seller_id]) {
        sellerBalances[item.seller_id] = {
          total: 0,
          deviceNames: [],
          siteFee: 0,
        };
      }
      sellerBalances[item.seller_id].total += itemTotal;
      sellerBalances[item.seller_id].deviceNames.push(item.name);
    }

    // 3. حساب رسوم الموقع لكل بائع
    let totalSiteFee = 0;
    for (const seller_id in sellerBalances) {
      const sellerTotal = +sellerBalances[seller_id].total;
      let siteFee;
      if (sellerTotal < 1000) {
        siteFee = 25;
      } else if (sellerTotal >= 1000 && sellerTotal < 10000) {
        siteFee = 0.025 * sellerTotal;
      } else {
        siteFee = 250;
      }
      sellerBalances[seller_id].siteFee = siteFee;
      totalSiteFee += siteFee;
    }

    // 4. إنشاء طلب واحد
    const order = await createOrder(buyer_id, total_price - totalSiteFee);

    // 5. إضافة عناصر الطلب مع السعر ناقص siteFee لكل بائع
    for (const item of cartItems) {
      const itemTotal = +item.price * +item.quantity;
      const sellerSiteFee = sellerBalances[item.seller_id].siteFee;
      const itemShare =
        itemTotal -
        (itemTotal / sellerBalances[item.seller_id].total) * sellerSiteFee; // توزيع الرسوم نسبيًا
      await addOrderItem(
        order.order_id,
        item.device_id,
        item.quantity,
        itemShare, // السعر الصافي للعنصر بعد خصم الرسوم
        item.seller_id
      );

      // تحديث حالة المنتج إلى "sold"
      await client.query(
        "UPDATE Devices SET status = 'sold' WHERE device_id = $1",
        [item.device_id]
      );
    }

    // 6. تحديث أرصدة البائعين وتسجيل المعاملات
    for (const seller_id in sellerBalances) {
      const { total, deviceNames, siteFee } = sellerBalances[seller_id];
      const sellerShare = total - siteFee; // خصم رسوم الموقع لكل بائع

      await updatePendingBalanceDb(client, parseInt(seller_id), +sellerShare);

      await logWalletUsingClientTransaction(
        client,
        parseInt(seller_id),
        +sellerShare,
        "pending",
        `رصيد معلق من بيع ${deviceNames.join(
          ", "
        )} بعد خصم رسوم الموقع ${siteFee} ج.م`
      );

      // إضافة رسوم الموقع لكل بائع إلى SiteWallet
      await client.query(
        "INSERT INTO SiteWallet (amount, transaction_type, description) VALUES ($1, $2, $3)",
        [
          siteFee,
          with_wallet ? "wallet" : "credit",
          `Site fee for seller ${seller_id} in order ${order.order_id}`,
        ]
      );
    }

    // 7. تسجيل الدفعة بناءً على طريقة الدفع
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

    // 8. إضافة بيانات الشحن
    const shipping_company = "Aramex";
    const tracking_number = `TRK-${order.order_id}-${Date.now()}`;
    await addShipping(
      order.order_id,
      shipping_address,
      shipping_company,
      tracking_number
    );

    // 10. تفريغ الكارت بعد الشراء
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

    let siteFee;

    // حساب رسوم الموقع
    if (total_price < 1000) {
      siteFee = 25; // رسوم ثابتة 25 جنيه إذا كان السعر أقل من 1000
    } else if (total_price >= 1000 && total_price < 10000) {
      siteFee = 0.025 * total_price; // 2.5% من السعر إذا كان بين 1000 و 10000
    } else if (total_price >= 10000) {
      siteFee = 250; // رسوم ثابتة 250 جنيه إذا كان السعر أكبر من 10000
    }

    // 2. إنشاء الطلب
    const order = await createOrder(buyer_id, total_price - siteFee);

    // 3. إضافة عنصر الطلب
    await addOrderItem(
      order.order_id,
      device_id,
      quantity,
      total_price - siteFee,
      seller_id
    );

    // تحديث حالة المنتج الى "sold"
    await client.query(
      "UPDATE Devices SET status = 'sold' WHERE device_id = $1",
      [device_id]
    );

    // 4. اضافة المبلغ لرصيد البائع وتسجيله فى سجل المعاملات
    await updatePendingBalanceDb(client, seller_id, +total_price - siteFee);

    // 5. اضافة المبلغ الى سجل المعاملات لدى البائع
    await logWalletUsingClientTransaction(
      client,
      seller_id,
      total_price - siteFee,
      "pending",
      `رصيد معلق من بيع ${device.name} بعد خصم رسوم الموقع ${siteFee} ج.م`
    );

    // 6. تسجيل الدفعة بناءً على طريقة الدفع
    let transaction_id;
    if (with_wallet) {
      // تسجيل دفعة رمزية كـ "wallet" بدلاً من Visa
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

      // 5. إضافة رسوم الموقع إلى رصيد الموقع بالفيزا
      await client.query(
        "INSERT INTO SiteWallet (amount, transaction_type, description) VALUES ($1, $2, $3)",
        [siteFee, "wallet", `Site fee for order ${order.order_id}`]
      );
    } else {
      // دفعة باستخدام Visa
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

      // 5. إضافة رسوم الموقع إلى رصيد الموقع بالمحفظة
      await client.query(
        "INSERT INTO SiteWallet (amount, transaction_type, description) VALUES ($1, $2, $3)",
        [siteFee, "credit", `Site fee for order ${order.order_id}`]
      );
    }

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
