import AppError from "../utils/AppError.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.user; // 🔹 نفترض أن `req.user` يحتوي على بيانات المستخدم من الـ Token

    if (!user) {
      throw new AppError("غير مسموح من فضلك سجل الدخول.", 401);
    }

    if (!roles.includes(user.role)) {
      throw new AppError("الوصول ممنوع", 403);
    }

    next();
  };
};
