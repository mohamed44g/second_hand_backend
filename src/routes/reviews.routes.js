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

//Public routes
router.get("/device/:device_id", getDeviceReviews);
router.get("/seller/:seller_id", getSellerReviews);

//Proteced routes
router.post("/device", auth, addDeviceReview);
router.post("/seller", auth, addSellerReview);

export default router;
