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
  changeUserRole,
  logout,
  resetPassword,
  changePassword,
  getStats,
} from "../controllers/user.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";
import upload from "../config/uploadConfig.js";
const router = express.Router();

router.post("/register", upload.single("file"), register);
router.post("/verification", sendVerificationCode);
router.post("/login", login);
router.post("/logout", logout);
router.post("/reset-password", resetPassword);
router.patch("/change-password", changePassword);
router.get("/stats", getStats);

//protected routes
router.patch("/", auth, updateUser);
router.get("/", auth, getUserById);
router.patch("/password", auth, changeUserPassword);
router.patch("/role", auth, changeUserRole);

//seller
router.get(
  "/seller/products",
  auth,
  authorizeRoles("seller"),
  getSellerProducts
);

//admin
router.delete("/:deletedAccountId", auth, deleteUser);
export default router;
