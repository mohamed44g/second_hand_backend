import { verifyAccessToken } from "../utils/jwtUtils.js";
import AppError from "../utils/AppError.js";

export const auth = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) {
    next(new AppError("Unauthorized", 401));
  }
  const token = authorization?.split(" ")[1];
  if (!token) {
    next(new AppError("Unauthorized", 401));
  }
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    next(new AppError("Unauthorized", 401));
  }
  req.user = decoded;
  next();
};
