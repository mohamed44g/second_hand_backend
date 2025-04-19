import express from "express";
import {
  createReport,
  getUserReports,
  getAllReports,
  updateReportStatus,
} from "../controllers/reports.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", auth, createReport);
router.get("/", auth, getUserReports);
router.get("/admin", auth, getAllReports); // للإدارة فقط (ممكن تضيف middleware للتحقق من الصلاحيات)
router.patch("/:report_id", auth, updateReportStatus); // للإدارة فقط

export default router;
