// routes/cart.routes.js
import express from "express";
import {
  addToCart,
  getCart,
  removeFromCart,
} from "../controllers/cart.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.post("/", auth, addToCart);
router.get("/", auth, getCart);
router.delete("/", auth, removeFromCart);

export default router;
