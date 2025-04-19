import express from "express";
import {
  sendVerificationCode,
  register,
  login,
  deleteUser,
  getSellerProducts,
} from "../controllers/user.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/register", register);
router.post("/verification", sendVerificationCode);
router.post("/login", login);
router.delete("/delete", auth, deleteUser);

//seller
router.get("/seller/products", auth, getSellerProducts);
export default router;
