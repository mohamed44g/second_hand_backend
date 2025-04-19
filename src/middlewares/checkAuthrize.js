import AppError from "../utils/AppError.js";
export const checkAuthrize = (...requiredRoles) => {
  return (req, res, next) => {
    const token = req.user;

    // Check if token exists and has the required properties
    if (!token || typeof token !== "object") {
      next(new AppError("غير مسجل سجل دخول", 401));
    }

    return requiredRoles.some((role) => {
      if (role === "admin") {
        token.is_admin === true ? next() : next(new AppError("غير مسموح", 403));
      }
      if (role === "seller") {
        token.is_seller === true
          ? next()
          : next(new AppError("غير مسموح", 403));
      }
    });
  };
};
