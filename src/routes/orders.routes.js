import express from "express";
import {
  checkoutFromCart,
  purchaseDirectly,
  getUserOrders,
} from "../controllers/orders.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get("/", auth, getUserOrders);
router.post("/checkout", auth, checkoutFromCart); // الشراء من الكارت
router.post("/purchase", auth, purchaseDirectly); // الشراء المباشر

export default router;
