import AppError from "../utils/AppError.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.user; // 🔹 نفترض أن `req.user` يحتوي على بيانات المستخدم من الـ Token

    if (!user) {
      throw new AppError("غير مسموح من فضلك سجل الدخول.", 401);
    }

    if (roles.includes("admin")) {
      if (!user.is_admin) {
        throw new AppError("غير مسموح لا يوجد صلاحية لهذا المستخدم", 403);
      }
      return next();
    } else if (roles.includes("seller")) {
      if (!user.is_seller) {
        throw new AppError("غير مسموح لا يوجد صلاحية لهذا المستخدم", 403);
      }
      return next();
    }

    next();
  };
};
