import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import { generateVerificationCode } from "../utils/helper.js";
import transporter from "../config/email.js";
import {
  deleteSellerDb,
  disableAccountDb,
  enableAccountDb,
  getAllSellersDb,
  userCheck,
  userCreate,
  userDelete,
  getUserByIdDb,
  updateUserDb,
  changeUserPasswordDb,
  changeUserRoleDb,
} from "../models/users.model.js";
import AppError from "../utils/AppError.js";
import { getDevicesBySellerIdDb } from "../models/products.model.js";
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtUtils.js";
import { Sendresponse } from "../utils/response.js";
export const register = AsyncWrapper(async (req, res, next) => {
  const {
    username,
    email,
    password,
    first_name,
    last_name,
    phone_number,
    address,
    is_seller,
    verificationCode,
  } = req.body;

  let identity_image = null;

  if (req.file) {
    identity_image = `uploads/${req.file?.filename}`.replace(/\\/g, "/");
  }

  //التحقق من وجود المستخدم
  const check = await userCheck(username, email);

  if (check) {
    return next(new AppError("User already exists", 400));
  }

  const sessionCode = req.session.verificationCode;

  if (!sessionCode || sessionCode.email !== email) {
    next(new AppError("Invalid verification code", 400));
  }

  if (
    sessionCode?.code !== verificationCode ||
    sessionCode?.expiresAt < Date.now()
  ) {
    return res.status(400).json({ msg: "Invalid verification code" });
  }

  //تشفير الباسورد
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = await userCreate(
    username,
    email,
    hashedPassword,
    first_name,
    last_name,
    phone_number,
    address,
    identity_image,
    is_seller
  );

  delete req.session.verificationCode;

  Sendresponse(res, 201, "User created successfully", {
    user: newUser,
  });
});

export const sendVerificationCode = AsyncWrapper(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const verificationCode = generateVerificationCode();

  //تسجيل الكود في الجلسة
  req.session.verificationCode = {
    code: verificationCode,
    email: email,
    expiresAt: Date.now() + 60 * 60 * 1000, //الكود صالح لمدة ساعة واحدة
  };

  // إرسال الكود عبر الإيميل
  const mailOptions = {
    from: "Second Hand <mohammedbadry456@gmail.com>",
    to: email,
    subject: "كود التحقق - Second Hand",
    html: `
      <h2>مرحبًا!</h2>
      <p>كود التحقق الخاص بك هو: <strong>${verificationCode}</strong></p>
      <p>الكود صالح لمدة ساعة واحدة فقط.</p>
      <p>إذا لم تطلب هذا الكود، يرجى تجاهل هذا الإيميل.</p>
    `,
  };

  await transporter.sendMail(mailOptions);

  Sendresponse(res, 200, "Verification code sent to your email.", {
    code: req.session.verificationCode,
  });
});

export const login = AsyncWrapper(async (req, res, next) => {
  const { email, password } = req.body;
  let is_seller = false;
  let is_admin = false;

  const user = await userCheck(null, email);
  if (!user) {
    return next(new AppError("Invalid username or password", 400));
  }
  //مقارنة الباسورد المحفوظ بالباسورد المشفر
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return next(new AppError("Invalid username or password", 400));
  }

  if (user.is_seller && !user.is_admin) {
    is_seller = true;
    is_admin = false;
  } else if (user.is_admin && user.is_seller) {
    is_seller = true;
    is_admin = true;
  } else if (user.is_admin && !user.is_seller) {
    is_seller = false;
    is_admin = true;
  }

  //توليد التوكن اللى بيخلى المستخدم مستمر فى تسجيل الدخول
  const AccessToken = generateAccessToken(
    user.user_id,
    user.email,
    is_seller,
    is_admin
  );
  const RefreshToken = generateRefreshToken(
    user.user_id,
    user.email,
    is_seller,
    is_admin
  );
  res.cookie("RefreshToken", RefreshToken, {
    httpOnly: process.env.NODE_ENV === "production" ? true : false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // صالح ل 7 أيام
  });

  Sendresponse(res, 200, "User logged in successfully", {
    AccessToken,
  });
});

export const logout = AsyncWrapper(async (req, res) => {
  // حذف الكوكيز الخاصة بالتوكن
  res.clearCookie("RefreshToken");
  Sendresponse(res, 200, "User logged out successfully");
});

export const getUserById = AsyncWrapper(async (req, res, next) => {
  const { userId } = req.user;
  const user = await getUserByIdDb(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  Sendresponse(res, 200, "User retrieved successfully", user);
});

export const updateUser = AsyncWrapper(async (req, res, next) => {
  const { userId } = req.user;
  const { username, email, first_name, last_name, phone_number, address } =
    req.body;

  const user = await updateUserDb(
    userId,
    username,
    email,
    first_name,
    last_name,
    phone_number,
    address
  );

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  Sendresponse(res, 200, "User updated successfully", user);
});

export const deleteUser = AsyncWrapper(async (req, res, next) => {
  const { userId, is_admin } = req.user;
  const { deletedAccountId } = req.params;
  const user = await userDelete(userId, is_admin, deletedAccountId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  Sendresponse(res, 200, "User deleted successfully");
});

export const changeUserPassword = AsyncWrapper(async (req, res, next) => {
  const { userId } = req.user;
  const { currentPassword, newPassword } = req.body;
  const user = await getUserByIdDb(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  // Compare the current password with the stored password
  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) {
    return next(new AppError("Invalid current password", 400));
  }
  // Hash the new password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  // Update the user's password
  await changeUserPasswordDb(userId, hashedPassword);
  Sendresponse(res, 200, "Password changed successfully");
});

export const getSellerProducts = AsyncWrapper(async (req, res, next) => {
  const seller_Id = req.user.userId;
  const devices = await getDevicesBySellerIdDb(seller_Id);
  if (!devices) {
    return next(new AppError("No devices found for this seller", 404));
  }
  Sendresponse(res, 200, "Seller devices retrieved successfully", devices);
});

// جلب كل التجار للادمن
export const getSellers = AsyncWrapper(async (req, res, next) => {
  const sellers = await getAllSellersDb();
  Sendresponse(res, 200, "Sellers fetched successfully", sellers);
});

// حذف تاجر للادمن
export const removeSeller = AsyncWrapper(async (req, res, next) => {
  const { user_id } = req.params;
  await deleteSellerDb(user_id);
  Sendresponse(res, 200, "Seller removed successfully", null);
});

// تعطيل اكونت التاجر للادمن
export const disableSeller = AsyncWrapper(async (req, res, next) => {
  const { user_id } = req.params;
  await disableAccountDb(user_id);
  Sendresponse(res, 200, "Seller disabled successfully", null);
});

// تفعيل حساب التاجر للادمن
export const enableSeller = AsyncWrapper(async (req, res, next) => {
  const { user_id } = req.params;
  await enableAccountDb(user_id);
  Sendresponse(res, 200, "Seller enabled successfully", null);
});

export const changeUserRole = AsyncWrapper(async (req, res, next) => {
  const { seller } = req.body;
  const user_id = req.user.userId;
  const changeRole = changeUserRoleDb(seller, user_id);

  if (!changeRole) {
    return next(AppError("حدث خطا اثناء تحديث دور المستخدم", 400));
  }

  Sendresponse(res, 200, "تم التحديث بنجاح سجل دخول من جديد", null);
});
