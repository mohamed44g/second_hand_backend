// controllers/review.controller.js
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import {
  createDeviceReview,
  createSellerReview,
  getReviewsByDeviceId,
  getSellerReviewsBySellerId,
} from "../models/reviews.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";

// استيراد الموديل الخاص بالمراجعات
export const getDeviceReviews = AsyncWrapper(async (req, res, next) => {
  const { device_id } = req.params;
  if (!device_id) {
    return next(new AppError("Please provide device_id", 400));
  }
  const reviews = await getReviewsByDeviceId(device_id);
  Sendresponse(res, 200, "Device reviews fetched successfully", reviews);
});

export const addDeviceReview = AsyncWrapper(async (req, res, next) => {
  const { device_id, rating, comment } = req.body;
  const user_id = req.user.userId;

  if (!device_id || !rating) {
    return next(new AppError("Please provide device_id and rating", 400));
  }

  if (rating < 1 || rating > 5) {
    return next(new AppError("Rating must be between 1 and 5", 400));
  }

  const review = await createDeviceReview(device_id, user_id, rating, comment);

  Sendresponse(res, 201, "Device review added successfully", { review });
});

// إضافة تقييم لبائع
export const addSellerReview = AsyncWrapper(async (req, res, next) => {
  const { seller_id, rating, comment } = req.body;
  const user_id = req.user.userId;

  if (!seller_id || !rating) {
    return next(new AppError("Please provide seller_id and rating", 400));
  }

  if (rating < 1 || rating > 5) {
    return next(new AppError("Rating must be between 1 and 5", 400));
  }

  const review = await createSellerReview(seller_id, user_id, rating, comment);

  Sendresponse(res, 201, "Seller review added successfully", { review });
});

export const getSellerReviews = AsyncWrapper(async (req, res, next) => {
  const { seller_id } = req.params;
  if (!seller_id) {
    return next(new AppError("Please provide seller_id", 400));
  }
  const reviews = await getSellerReviewsBySellerId(seller_id);
  Sendresponse(res, 200, "Seller reviews fetched successfully", reviews);
});
