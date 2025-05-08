import express from "express";
import {
  sendVerificationCode,
  register,
  login,
  deleteUser,
  getSellerProducts,
  updateUser,
  getUserById,
  changeUserPassword,
} from "../controllers/user.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import upload from "../config/uploadConfig.js";
const router = express.Router();

router.post("/register", upload.single("file"), register);
router.post("/verification", sendVerificationCode);
router.post("/login", login);

//protected routes
router.patch("/", auth, updateUser);
router.delete("/delete", auth, deleteUser);
router.get("/", auth, getUserById);
router.patch("/password", auth, changeUserPassword);

//seller
router.get("/seller/products", auth, getSellerProducts);
export default router;
