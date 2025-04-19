// models/bids.model.js
import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

export const getAllBids = async () => {
  const result = await pool.query(
    `SELECT b.*, u.username AS bidder_username, d.*
         FROM bids b
         JOIN Users u ON b.user_id = u.user_id
         JOIN Devices d ON b.device_id = d.device_id`
  );
  return result.rows;
};

export const getBidByIdDb = async (bid_id) => {
  const result = await pool.query(
    `SELECT b.*, u.username AS bidder_username, d.*
         FROM bids b
         JOIN Users u ON b.user_id = u.user_id
         JOIN Devices d ON b.device_id = d.device_id
         WHERE b.bid_id = $1`,
    [bid_id]
  );
  if (result.rows.length === 0) {
    throw new AppError("Bid not found", 404);
  }
  return result.rows[0];
};

export const createBid = async (
  device_id,
  user_id,
  minimum_increment,
  auction_end_time,
) => {
  const result = await pool.query(
    `INSERT INTO bids (device_id, user_id, minimum_increment, auction_end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
    [device_id, user_id, minimum_increment, auction_end_time]
  );
  return result.rows[0];
};

// دالة لجلب أرصدة المستخدم
export const getUserBalances = async (user_id) => {
  const result = await pool.query(
    `SELECT wallet_balance, pending_balance FROM Users WHERE user_id = $1`,
    [user_id]
  );

  console.log("getUserBalances", result.rows, user_id);
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
  console.log(wallet_balance);
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
    const bid = await client.query(`SELECT * FROM Bids WHERE bid_id = $1`, [
      bid_id,
    ]);
    if (bid.rows.length === 0) {
      throw new AppError("Bid not found", 404);
    }
    const auction = bid.rows[0];
    const currentTime = new Date();
    const auctionEndTime = new Date(auction.auction_end_time);
    if (currentTime > auctionEndTime) {
      throw new AppError("This auction has ended", 400);
    }

    // 2. التحقق من أرصدة المستخدم
    const balances = await getUserBalances(user_id);
    console.log(balances);
    const walletBalance = balances.wallet_balance;
    const pendingBalance = Math.round(balances.pending_balance);
    if (walletBalance < bid_amount) {
      throw new AppError(
        `Insufficient balance. Your available balance is ${walletBalance}, but you bid ${bid_amount}`,
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
        `Bid amount must be at least ${minimumRequiredBid} (current highest: ${
          highestBid ? highestBid.bid_amount : auction.starting_price
        }, minimum increment: ${auction.minimum_increment})`,
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
    console.log(
      `Updated Wallet Balance: ${updatedWalletBalance}, Updated Pending Balance: ${updatedPendingBalance}`
    );
    await updateUserBalances(
      client,
      user_id,
      updatedWalletBalance,
      updatedPendingBalance
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
    if (currentTime > auctionEndTime) {
      throw new AppError("This auction has ended, cannot cancel bid", 400);
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
      `SELECT b.*, u.user_id AS seller_id
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
    const currentTime = new Date();
    const auctionEndTime = new Date(auction.auction_end_time);
    // if (currentTime < auctionEndTime) {
    //   throw new AppError("Auction has not yet ended", 400);
    // }

    // 2. جلب أعلى مزايدة
    const highestBidResult = await client.query(
      `SELECT * FROM BidHistory
       WHERE bid_id = $1
       ORDER BY bid_amount DESC
       LIMIT 1`,
      [bid_id]
    );
    if (highestBidResult.rows.length === 0) {
      throw new AppError("No bids placed on this auction", 400);
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

    // 5. نقل المبلغ لرصيد البائع
    const sellerBalances = await getUserBalances(sellerId);
    console.log("sellerBalances", sellerBalances, "for sellerId", sellerId);
    const sellerNewWalletBalance =
      +sellerBalances.wallet_balance + +winningAmount;
    await updateUserBalances(
      client,
      sellerId,
      sellerNewWalletBalance,
      sellerBalances.pending_balance
    );

    // 6. إرجاع الرصيد المعلق لباقي المستخدمين اللي ما فازوش
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
    }

    // 7. تحديث حالة المزاد إنه انتهى
    await client.query(`UPDATE Bids SET is_ended = TRUE WHERE bid_id = $1`, [
      bid_id,
    ]);

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
    `SELECT b.*, u.username AS bidder_username
         FROM BidHistory b
         JOIN Users u ON b.user_id = u.user_id
         WHERE b.bid_id = $1`,
    [bid_id]
  );
  return result.rows;
};
