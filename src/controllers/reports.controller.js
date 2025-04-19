import {
  createReportDb,
  getUserReportstDb,
  getAllReportstDb,
  updateReportStatustDb,
} from "../models/reports.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";

// إنشاء بلاغ جديد
export const createReport = AsyncWrapper(async (req, res, next) => {
  const { reported_entity_type, reported_entity_id, reason } = req.body;
  const reporter_id = req.user.userId;

  if (!reported_entity_type || !reported_entity_id || !reason) {
    return next(
      new AppError("Reported entity type, ID, and reason are required", 400)
    );
  }

  const report = await createReportDb(
    reporter_id,
    reported_entity_type,
    reported_entity_id,
    reason
  );
  Sendresponse(res, 201, "Report created successfully", report);
});

// جلب بلاغات المستخدم
export const getUserReports = AsyncWrapper(async (req, res, next) => {
  const reporter_id = req.user.userId;
  const reports = await getUserReportstDb(reporter_id);
  Sendresponse(res, 200, "User reports fetched successfully", reports);
});

// جلب كل البلاغات (للإدارة)
export const getAllReports = AsyncWrapper(async (req, res, next) => {
  // افترضنا إنك هتعمل تحقق على صلاحيات الإدارة هنا
  const reports = await getAllReportstDb();
  Sendresponse(res, 200, "All reports fetched successfully", reports);
});

// تحديث حالة البلاغ
export const updateReportStatus = AsyncWrapper(
  async (req, res, next) => {
    const { report_id } = req.params;
    const { status } = req.body;

    const report = await updateReportStatustDb(report_id, status);
    Sendresponse(res, 200, "Report status updated successfully", report);
  }
);
