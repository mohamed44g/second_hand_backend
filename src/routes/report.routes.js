import express from "express";
import {
  createReport,
  getUserReports,
  getAllReports,
  updateReportStatus,
} from "../controllers/reports.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";

const router = express.Router();

router.post("/", auth, createReport);
router.get("/", auth, getUserReports);

//admin routes
router.get("/admin", auth, authorizeRoles("admin"), getAllReports); // للإدارة فقط (ممكن تضيف middleware للتحقق من الصلاحيات)
router.patch("/:report_id", auth, authorizeRoles("admin"), updateReportStatus); // للإدارة فقط

export default router;
