import {
  getAllUsersDb,
  getSystemStatsDb,
  updateUserRoleDb,
} from "../models/admin.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";

// جلب كل المستخدمين
export const getUsers = AsyncWrapper(async (req, res, next) => {
  const users = await getAllUsersDb();
  Sendresponse(res, 200, "Users fetched successfully", users);
});

// تحديث دور المستخدم
export const setUserRole = AsyncWrapper(async (req, res, next) => {
  const { user_id } = req.params;

  const user = await updateUserRoleDb(user_id);
  Sendresponse(res, 200, "User role updated successfully", user);
});

// جلب إحصائيات النظام
export const getStats = AsyncWrapper(async (req, res, next) => {
  const stats = await getSystemStatsDb();
  Sendresponse(res, 200, "System stats fetched successfully", stats);
});
