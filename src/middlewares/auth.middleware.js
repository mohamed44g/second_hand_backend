import { verifyAccessToken } from "../utils/jwtUtils.js";
import AppError from "../utils/AppError.js";

export const auth = async (req, res, next) => {
  const { authorization } = req.headers;
  try {
    if (!authorization) {
      throw new AppError("Authorization header is missing", 401);
    }
    const token = authorization.split(" ")[1];
    if (!token) {
      throw new AppError("Token is missing", 401);
    }
    const decoded = await verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    throw new AppError("unAuthrized", 401);
  }
};
