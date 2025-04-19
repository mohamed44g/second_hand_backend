import {
  createSponsoredAdDb,
  getActiveSponsoredAdsDb,
  getUserSponsoredAdsDb,
} from "../models/sponsoredAds.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import { calculateDays } from "../utils/calcDuration.js";

// إنشاء إعلان ممول جديد
export const createSponsoredAd = AsyncWrapper(async (req, res, next) => {
  const { ad_entity_type, ad_entity_id, end_date } = req.body;
  const cost = calculateDays(new Date(), end_date) * 100;
  const user_id = req.user.userId;

  if (!ad_entity_type || !ad_entity_id || !end_date) {
    return next(
      new AppError(
        "Entity type, entity ID, start date, and end date are required",
        400
      )
    );
  }

  const ad = await createSponsoredAdDb(
    ad_entity_type,
    ad_entity_id,
    cost,
    user_id,
    end_date
  );
  Sendresponse(res, 201, "Sponsored ad created successfully", ad);
});

// جلب الإعلانات الممولة النشطة
export const getActiveSponsoredAds = AsyncWrapper(async (req, res, next) => {
  const ads = await getActiveSponsoredAdsDb();
  Sendresponse(res, 200, "Active sponsored ads fetched successfully", ads);
});

// جلب إعلانات المستخدم
export const getUserSponsoredAds = AsyncWrapper(async (req, res, next) => {
  const user_id = req.user.userId;
  const ads = await getUserSponsoredAdsDb(user_id);
  Sendresponse(res, 200, "User sponsored ads fetched successfully", ads);
});
