import { pool } from "../config/db.js";
import AppError from "../utils/AppError.js";

// إنشاء إعلان ممول جديد
export const createSponsoredAdDb = async (
  ad_entity_type,
  ad_entity_id,
  amount,
  user_id,
  end_date
) => {
  const validEntityTypes = ["device", "auction"];
  if (!validEntityTypes.includes(ad_entity_type)) {
    throw new AppError("Invalid entity type", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // تحقق من رصيد محفظة البائع
    const walletResult = await client.query(
      `SELECT wallet_balance FROM Users WHERE user_id = $1`,
      [user_id]
    );

    const walletBalance = parseInt(walletResult.rows[0].wallet_balance);
    if (walletBalance < amount) {
      throw new AppError(
        `الرصيد غير كافى رصيدك هو ${walletBalance} الرصيد المطلوب هو ${amount}`,
        400
      );
    }

    // خصم المبلغ من محفظة البائع
    await client.query(
      `UPDATE Users SET wallet_balance = wallet_balance - $1 WHERE user_id = $2`,
      [amount, user_id]
    );

    // إضافة سجل العملية في محفظة البائع
    await client.query(
      `INSERT INTO wallet_history (user_id, amount, transaction_type, description)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
      [user_id, amount, `withdraw`, `دفع اعلان على منتج رقم ${ad_entity_id}`]
    );

    // إضافة الإعلان الممول
    const result = await client.query(
      `INSERT INTO SponsoredAds (ad_entity_type, ad_entity_id, user_id, end_date, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING *`,
      [ad_entity_type, ad_entity_id, user_id, end_date]
    );
    if (result.rows.length === 0) {
      throw new AppError("Failed to create sponsored ad", 500);
    }

    const sponsoredAd = result.rows[0];

    // إضافة سجل العملية في محفظة البائع
    await client.query(
      `INSERT INTO AdPayments (ad_id, payment_method, amount, transaction_id, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
      [
        sponsoredAd.ad_id,
        "wallet",
        amount,
        `sponsored_ad_${sponsoredAd.ad_id}`,
        user_id,
      ]
    );

    await client.query("COMMIT");
    return sponsoredAd;
  } catch (error) {
    throw new AppError(error, 500);
  } finally {
    client.release();
  }
};

// جلب الإعلانات الممولة النشطة
export const getActiveSponsoredAdsDb = async () => {
  const result = await pool.query(
    `SELECT sa.*,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.name
              WHEN sa.ad_entity_type = 'auction' THEN d2.name
            END AS entity_name,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.starting_price
              WHEN sa.ad_entity_type = 'auction' THEN d2.starting_price
            END AS price,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.image_url
              WHEN sa.ad_entity_type = 'auction' THEN d2.image_url
            END AS image
     FROM SponsoredAds sa
     LEFT JOIN Devices d ON sa.ad_entity_type = 'device' AND sa.ad_entity_id = d.device_id
     LEFT JOIN Bids b ON sa.ad_entity_type = 'auction' AND sa.ad_entity_id = b.bid_id
     LEFT JOIN Devices d2 ON b.device_id = d2.device_id
     WHERE sa.status = 'active' 
       AND sa.start_date <= CURRENT_TIMESTAMP 
       AND sa.end_date >= CURRENT_TIMESTAMP`
  );
  return result.rows;
};

// جلب إعلانات المستخدم
export const getUserSponsoredAdsDb = async (user_id) => {
  const result = await pool.query(
    `SELECT sa.*,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.name
              WHEN sa.ad_entity_type = 'auction' THEN d2.name
            END AS entity_name,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.starting_price
              WHEN sa.ad_entity_type = 'auction' THEN d2.starting_price
            END AS price,
            CASE 
              WHEN sa.ad_entity_type = 'device' THEN d.image_url
              WHEN sa.ad_entity_type = 'auction' THEN d2.image_url
            END AS image
     FROM SponsoredAds sa
     LEFT JOIN Devices d ON sa.ad_entity_type = 'device' AND sa.ad_entity_id = d.device_id
     LEFT JOIN Bids b ON sa.ad_entity_type = 'auction' AND sa.ad_entity_id = b.bid_id
     LEFT JOIN Devices d2 ON b.device_id = d2.device_id
     WHERE sa.user_id = $1`,
    [user_id]
  );
  return result.rows;
};
