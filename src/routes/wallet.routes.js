import express from "express";
import {
  getWallet,
  addToWallet,
  withdrawFromWallet,
  getWalletHistory,
} from "../controllers/wallet.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

//wallet
router.get("/", auth, getWallet);
router.post("/deposit", auth, addToWallet);
router.post("/withdraw", auth, withdrawFromWallet);
router.get("/history", auth, getWalletHistory);

export default router;
