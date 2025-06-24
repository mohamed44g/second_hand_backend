// models/bids.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { logWalletUsingClientTransaction } from "./wallet.model.js";
import { createOrder, addOrderItem, addShipping } from "./orders.model.js";
import { updatePendingBalanceDb } from "./wallet.model.js";

export const getAllBids = async () => {
  const result = await pool.query(
    `SELECT b.*, m.main_category_name, CONCAT(u.first_name, ' ', u.last_name) AS seller_username,
        u.address As seller_address, d.*,
      CASE 
         WHEN sa.ad_id IS NOT NULL THEN TRUE 
         ELSE FALSE 
       END AS is_Sponsored, 
              (SELECT image_path 
        FROM DeviceImages di 
        WHERE di.device_id = d.device_id 
        ORDER BY di.created_at ASC 
        LIMIT 1) AS image_url,
       sa.end_date AS ad_end_date
         FROM bids b
         JOIN Users u ON b.user_id = u.user_id
         JOIN Devices d ON b.device_id = d.device_id
         JOIN maincategories m ON d.main_category_id = m.main_category_id 
         LEFT JOIN SponsoredAds sa 
  ON sa.ad_entity_type = 'auction'
  AND sa.ad_entity_id = d.device_id
  AND sa.start_date <= CURRENT_TIMESTAMP 
  AND sa.end_date >= CURRENT_TIMESTAMP WHERE d.status = 'accepted' OR d.status = 'sold' ORDER BY end_date`
  );
  return result.rows;
};

export const getLatestAuctionsDb = async (limit = 4) => {
  const result = await pool.query(
    `SELECT 
        d.*, 
        c.main_category_name,
        CONCAT(u.first_name, ' ', u.last_name) AS seller_username,
        u.address AS seller_address,
        b.*,
        (SELECT image_path 
         FROM DeviceImages di 
         WHERE di.device_id = d.device_id 
         ORDER BY di.created_at ASC 
         LIMIT 1) AS image_url,
        sa.start_date AS ad_start_date,
        CASE 
          WHEN sa.ad_id IS NOT NULL THEN TRUE 
          ELSE FALSE 
        END AS is_Sponsored
     FROM Bids b
     JOIN Devices d ON b.device_id = d.device_id
     JOIN maincategories c ON d.main_category_id = c.main_category_id 
     JOIN Users u ON d.seller_id = u.user_id 
     LEFT JOIN SponsoredAds sa 
        ON sa.ad_entity_id = b.bid_id 
        AND sa.ad_entity_type = 'auction' 
        AND sa.end_date >= CURRENT_TIMESTAMP
     WHERE d.is_auction = true and b.auction_end_time > CURRENT_TIMESTAMP and d.status = 'accepted'
     ORDER BY
        CASE WHEN sa.ad_id IS NOT NULL THEN 0 ELSE 1 END,
        sa.end_date DESC NULLS LAST,
        b.auction_end_time DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

export const getBidByIdDb = async (bid_id) => {
  const result = await pool.query(
    `SELECT b.*, CONCAT(u.first_name, ' ', u.last_name) AS bidder_username, d.*, c.main_category_name
         FROM bids b
         JOIN Users u ON b.user_id = u.user_id
         JOIN Devices d ON b.device_id = d.device_id
         JOIN maincategories c ON d.main_category_id = c.main_category_id
         WHERE b.bid_id = $1`,
    [bid_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Bid not found", 404);
  }

  const imagesResult = await pool.query(
    `SELECT image_path FROM DeviceImages WHERE device_id = $1`,
    [result.rows[0].device_id]
  );
  console.log(imagesResult);
  return { bid: result.rows[0], images: [...imagesResult.rows] };
};

export const createBid = async (
  device_id,
  user_id,
  minimum_increment,
  auction_end_time,
  minimumNonCancellablePrice
) => {
  const checkActivty = await pool.query(
    `SELECT status FROM users WHERE user_id = $1`,
    [user_id]
  );

  if (checkActivty?.rows[0]?.status !== "active") {
    throw new AppError("حسابك معطل لا يمكنك نشر منتجات الان.", 403);
  }
  const result = await pool.query(
    `INSERT INTO bids (device_id, user_id, minimum_increment, auction_end_time,minimumNonCancellablePrice)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
    [
      device_id,
      user_id,
      minimum_increment,
      auction_end_time,
      minimumNonCancellablePrice,
    ]
  );
  return result.rows[0];
};

// دالة لجلب أرصدة المستخدم
export const getUserBalances = async (user_id) => {
  const result = await pool.query(
    `SELECT wallet_balance, pending_balance FROM Users WHERE user_id = $1`,
    [user_id]
  );

  if (result.rows.length === 0) {
    throw new AppError("User not found", 404);
  }
  return result.rows[0];
};

// دالة لتحديث أرصدة المستخدم
export const updateUserBalances = async (
  client,
  user_id,
  wallet_balance,
  pending_balance
) => {
  const result = await client.query(
    `UPDATE Users SET wallet_balance = $1, pending_balance = $2 WHERE user_id = $3 RETURNING *`,
    [wallet_balance, parseInt(pending_balance), user_id]
  );
  return result.rows[0];
};

// دالة للتحقق من حالة المزاد
export const getBidById = async (bid_id) => {
  const result = await pool.query(`SELECT * FROM Bids WHERE bid_id = $1`, [
    bid_id,
  ]);
  if (result.rows.length === 0) {
    throw new AppError("Bid not found", 404);
  }
  return result.rows[0];
};

// دالة لإضافة مزايدة في BidHistory مع إدارة الرصيد المعلق
export const addBidToHistory = async (bid_id, user_id, bid_amount) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. التحقق من حالة المزاد
    const bid = await client.query(
      `SELECT Bids.*, d.status,d.seller_id FROM Bids JOIN Devices d ON Bids.device_id = d.device_id WHERE bid_id = $1`,
      [bid_id]
    );

    if (bid.rows[0].status !== "accepted") {
      throw new AppError("المزاد غير متاح حاليا فى انتظار الموافقة.", 400);
    }

    if (bid.rows.length === 0) {
      throw new AppError("Bid not found", 404);
    }

    if (bid.rows[0].seller_id === user_id) {
      throw new AppError("لا يمكنك المزايدة على مزادك الخاص.", 400);
    }

    const auction = bid.rows[0];
    const currentTime = new Date();
    const auctionEndTime = new Date(auction.auction_end_time);
    if (currentTime > auctionEndTime && !auction.is_ended) {
      throw new AppError("لا يمكن المزايدة المزاد انتهى.", 400);
    }

    // 2. التحقق من أرصدة المستخدم
    const balances = await getUserBalances(user_id);
    const walletBalance = balances.wallet_balance;
    const pendingBalance = Math.round(balances.pending_balance);
    if (walletBalance < bid_amount) {
      throw new AppError(
        `الرصيد غير كافى الرصيد المطلوب للمزايدة هو ${bid_amount} (الرصيد الموجود هو ${walletBalance})`,
        400
      );
    }

    // 3. التحقق من أعلى مزايدة حالية
    const highestBidResult = await client.query(
      `SELECT * FROM BidHistory
       WHERE bid_id = $1
       ORDER BY bid_amount DESC
       LIMIT 1`,
      [bid_id]
    );
    const highestBid = highestBidResult.rows[0];
    const minimumRequiredBid = highestBid
      ? highestBid.bid_amount + auction.minimum_increment
      : auction.starting_price + auction.minimum_increment;

    if (bid_amount < minimumRequiredBid) {
      throw new AppError(
        `المزايدة لازم تبقى ع الاقل ${minimumRequiredBid} اعلى مزايدة حاليا هى ${
          highestBid ? highestBid.bid_amount : auction.starting_price
        } الحد الادنى للزيادة هو ${auction.minimum_increment}`,
        400
      );
    }

    // 4. إذا كان المستخدم عنده مزايدة سابقة في نفس المزاد، نرجع المبلغ المعلق القديم
    if (highestBid && highestBid.user_id === user_id) {
      const newPendingBalance = pendingBalance - highestBid.bid_amount;
      const newWalletBalance = walletBalance + highestBid.bid_amount;
      await updateUserBalances(
        client,
        user_id,
        newWalletBalance,
        newPendingBalance
      );
    }

    // 5. نقل المبلغ من wallet_balance إلى pending_balance
    const updatedWalletBalance = walletBalance - bid_amount;
    const updatedPendingBalance = pendingBalance + bid_amount;
    await updateUserBalances(
      client,
      user_id,
      updatedWalletBalance,
      updatedPendingBalance
    );

    await logWalletUsingClientTransaction(
      client,
      user_id,
      bid_amount,
      "withdraw",
      "سحب رصيد لإجراء مزايدة"
    );

    // 6. إضافة المزايدة في BidHistory
    const result = await client.query(
      `INSERT INTO BidHistory (bid_id, user_id, bid_amount)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [bid_id, user_id, bid_amount]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// دالة لجلب أعلى مزايدة حالية لمزاد معين
export const getHighestBidForAuction = async (bid_id) => {
  const result = await pool.query(
    `SELECT * FROM BidHistory
     WHERE bid_id = $1
     ORDER BY bid_amount DESC
     LIMIT 1`,
    [bid_id]
  );
  return result.rows[0];
};

// دالة لإلغاء مزايدة وإرجاع الرصيد
export const cancelBid = async (bid_id, user_id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. التحقق من حالة المزاد
    const bid = await client.query(`SELECT * FROM Bids WHERE bid_id = $1`, [
      bid_id,
    ]);
    if (bid.rows.length === 0) {
      throw new AppError("Bid not found", 404);
    }
    const auction = bid.rows[0];
    const currentTime = new Date();
    const auctionEndTime = new Date(auction.auction_end_time);
    if (currentTime > auctionEndTime || auction.is_ended) {
      throw new AppError("المزاد انتهى مينفعش تلغى المزايدة دلوقتى.", 400);
    }

    // 2. جلب المزايدة الخاصة بالمستخدم
    const userBid = await client.query(
      `SELECT * FROM BidHistory WHERE bid_id = $1 AND user_id = $2`,
      [bid_id, user_id]
    );
    if (userBid.rows.length === 0) {
      throw new AppError("No bid found for this user in this auction", 404);
    }
    const bidAmount = userBid.rows[0].bid_amount;

    // 3. إرجاع الرصيد من pending_balance إلى wallet_balance
    const balances = await getUserBalances(user_id);
    const updatedWalletBalance = +balances.wallet_balance + +bidAmount;
    const updatedPendingBalance = +balances.pending_balance - +bidAmount;
    await updateUserBalances(
      client,
      user_id,
      updatedWalletBalance,
      updatedPendingBalance
    );

    await logWalletUsingClientTransaction(
      client,
      user_id,
      +bidAmount,
      "deposit",
      "إرجاع رصيد المزايدة المُلغاة"
    );

    // 4. حذف المزايدة من BidHistory
    await client.query(
      `DELETE FROM BidHistory WHERE bid_id = $1 AND user_id = $2`,
      [bid_id, user_id]
    );

    await client.query("COMMIT");
    return { message: "Bid canceled and balance returned" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// دالة لتحديد الفائز ونقل الرصيد للبائع
export const finalizeAuction = async (bid_id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. التحقق من حالة المزاد
    const bidResult = await client.query(
      `SELECT b.*, d.device_id,u.user_id AS seller_id, d.name AS device_name
       FROM Bids b
       JOIN Devices d ON b.device_id = d.device_id
       JOIN Users u ON b.user_id = u.user_id
       WHERE bid_id = $1`,
      [bid_id]
    );
    if (bidResult.rows.length === 0) {
      throw new AppError("Bid not found", 404);
    }
    const auction = bidResult.rows[0];
    const sellerId = auction.seller_id;
    if (auction.bid_status === "ended" || auction.bid_status === "cancled") {
      throw new AppError("المزاد انتهى خلاص", 400);
    }

    // 2. جلب أعلى مزايدة
    const highestBidResult = await client.query(
      `SELECT * FROM BidHistory
       WHERE bid_id = $1
       ORDER BY bid_amount DESC
       LIMIT 1`,
      [bid_id]
    );
    if (highestBidResult.rows.length === 0) {
      throw new AppError("مفيش حد شارك فى المزاد", 400);
    }
    const highestBid = highestBidResult.rows[0];
    const winnerId = highestBid.user_id;
    const winningAmount = highestBid.bid_amount;

    // 3. التحقق من الرصيد المعلق للفائز
    const winnerBalances = await getUserBalances(winnerId);
    if (winnerBalances.pending_balance < winningAmount) {
      throw new AppError(
        `Winner's pending balance is insufficient. Pending: ${winnerBalances.pending_balance}, Required: ${winningAmount}`,
        400
      );
    }

    // 4. خصم المبلغ من الرصيد المعلق للفائز
    const winnerNewPendingBalance =
      winnerBalances.pending_balance - winningAmount;
    await updateUserBalances(
      client,
      winnerId,
      winnerBalances.wallet_balance,
      winnerNewPendingBalance
    );

    // انشاء طلب بشراء الجهاز
    const buyer_id = winnerId; // الفائز هو المشتري
    const buyer_address = await client.query(
      `SELECT address FROM users WHERE user_id = $1`,
      [buyer_id]
    );

    const shipping_address = buyer_address.rows[0].address;
    const order = await createOrder(buyer_id, winningAmount);

    // إضافة عنصر الطلب
    await addOrderItem(
      order.order_id,
      auction?.device_id,
      1,
      winningAmount,
      sellerId
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

    // إرجاع الرصيد المعلق لباقي المستخدمين اللي ما فازوش
    const otherBids = await client.query(
      `SELECT * FROM BidHistory WHERE bid_id = $1 AND user_id != $2`,
      [bid_id, winnerId]
    );
    for (const bid of otherBids.rows) {
      const loserId = bid.user_id;
      const bidAmount = bid.bid_amount;
      const loserBalances = await getUserBalances(loserId);
      const loserNewWalletBalance = loserBalances.wallet_balance + bidAmount;
      const loserNewPendingBalance = loserBalances.pending_balance - bidAmount;
      await updateUserBalances(
        client,
        loserId,
        loserNewWalletBalance,
        loserNewPendingBalance
      );

      await logWalletUsingClientTransaction(
        client,
        loserId,
        +bidAmount,
        "deposit",
        `إرجاع رصيد المزايدةالمزاد على ${auction.device_name}انتهى ولم تفز به مع الاسف`
      );
    }

    // 7. تحديث حالة المزاد إنه انتهى
    await client.query(
      `UPDATE Bids SET bid_status = 'ended', winning_bid_id = $1 WHERE bid_id = $2`,
      [winnerId, bid_id]
    );

    await client.query(
      `UPDATE devices SET status = 'sold' WHERE device_id = $1`,
      [auction?.device_id]
    );

    await client.query("COMMIT");
    return { winnerId, winningAmount, sellerId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getBidHistoryByIdDb = async (bid_id) => {
  const result = await pool.query(
    `SELECT b.*, CONCAT(u.first_name, ' ', u.last_name) AS bidder_username
         FROM BidHistory b
         JOIN Users u ON b.user_id = u.user_id
         WHERE b.bid_id = $1`,
    [bid_id]
  );
  return result.rows;
};

export const cancelBidSellerDb = async (bid_id) => {
  const bid = await getBidById(bid_id);
  const getHighestBid = await getHighestBidForAuction(bid_id);
  if (!bid) {
    throw new AppError("Bid not found", 404);
  }

  if (bid.bid_status === "ended") {
    throw new AppError("المزاد منتهى.", 400);
  }

  if (
    getHighestBid &&
    bid.minimumnoncancellableprice <= getHighestBid.bid_amount
  ) {
    throw new AppError(
      `لا يمكن الغاء المزاد لانه تجاوز السعر المتوقع وهو ${bid.minimumnoncancellableprice} ج.م`,
      400
    );
  }
  const result = await pool.query(
    `UPDATE Bids SET bid_status = 'cancled' WHERE bid_id = $1`,
    [bid_id]
  );
  return result.rows[0];
};
