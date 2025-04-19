import express from "express";
import {
  getStats,
  getUsers,
  setUserRole,
} from "../controllers/admin.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import {
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orders.controller.js";
import {
  disableSeller,
  enableSeller,
  getSellers,
  removeSeller,
} from "../controllers/user.controller.js";

const router = express.Router();

// جلب كل المستخدمين
router.get("/users", auth, getUsers);
// تحديث دور المستخدم
router.patch("/users/:user_id", auth, setUserRole);

// الطلبات
router.get("/orders", auth, getAllOrders);
router.patch("/orders/:order_id", auth, updateOrderStatus); // للإدارة فقط (ممكن تضيف middleware للتحقق من الصلاحيات)

// التجار
router.get("/sellers", auth, getSellers);
router.delete("/sellers/:user_id", auth, removeSeller);
router.patch("/sellers/:user_id/enable", auth, enableSeller);
router.patch("/sellers/:user_id/disable", auth, disableSeller);

// الاحصائيات
router.get("/statistics", getStats);

export default router;
