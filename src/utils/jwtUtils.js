import jwt from "jsonwebtoken";

export const generateAccessToken = (userId, email, is_seller, is_admin) => {
  return jwt.sign(
    { userId, email, is_seller, is_admin },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    }
  );
};

export const generateRefreshToken = (userId, email, is_seller, is_admin) => {
  return jwt.sign(
    { userId, email, is_seller, is_admin },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
