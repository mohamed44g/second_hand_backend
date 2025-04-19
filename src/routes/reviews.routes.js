// routes/reviewRoutes.js
import express from "express";
import {
  addDeviceReview,
  addSellerReview,
  getDeviceReviews,
  getSellerReviews,
} from "../controllers/reviews.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/device", auth, addDeviceReview);
router.get("/device/:device_id", auth, getDeviceReviews);

router.post("/seller", auth, addSellerReview);
router.get("/seller/:seller_id", auth, getSellerReviews);

export default router;
