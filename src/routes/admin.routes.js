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
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";

const router = express.Router();

// جلب كل المستخدمين
router.get("/users", auth, authorizeRoles("admin"), getUsers);
// تحديث دور المستخدم
router.patch("/users/:user_id", auth, authorizeRoles("admin"), setUserRole);

// الطلبات
router.get("/orders", auth, authorizeRoles("admin"), getAllOrders);
router.patch(
  "/orders/:order_id",
  auth,
  authorizeRoles("admin"),
  updateOrderStatus
); // للإدارة فقط (ممكن تضيف middleware للتحقق من الصلاحيات)

// التجار
router.get("/sellers", auth, authorizeRoles("admin"), getSellers);
router.delete("/sellers/:user_id", auth, authorizeRoles("admin"), removeSeller);
router.patch(
  "/sellers/:user_id/enable",
  auth,
  authorizeRoles("admin"),
  enableSeller
);
router.patch(
  "/sellers/:user_id/disable",
  auth,
  authorizeRoles("admin"),
  disableSeller
);

// الاحصائيات
router.get("/statistics", auth, authorizeRoles("admin"), getStats);

export default router;
