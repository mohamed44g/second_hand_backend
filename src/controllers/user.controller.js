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
    identity_image,
    is_seller,
    verificationCode,
  } = req.body;

  //التحقق من وجود المستخدم
  const check = await userCheck(username, email);

  const sessionCode = req.session.verificationCode;
  console.log(sessionCode, "ver", verificationCode);

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
      <p>الكود صالح لمدة 10 دقائق فقط.</p>
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
  const user = await userCheck(null, email);
  if (!user) {
    return next(new AppError("Invalid username or password", 400));
  }
  //مقارنة الباسورد المحفوظ بالباسورد المشفر
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return next(new AppError("Invalid username or password", 400));
  }

  //توليد التوكن اللى بيخلى المستخدم مستمر فى تسجيل الدخول
  const AccessToken = generateAccessToken(
    user.user_id,
    user.email,
    user.is_seller,
    user.is_seller
  );
  const RefreshToken = generateRefreshToken(
    user.user_id,
    user.email,
    user.is_seller
  );
  res.cookie("RefreshToken", RefreshToken, {
    httpOnly: process.env.NODE_ENV === "production" ? true : false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // صالح ل 7 أيام
  });

  Sendresponse(res, 200, "User logged in successfully", {
    AccessToken,
  });
});

export const deleteUser = AsyncWrapper(async (req, res, next) => {
  const { userId } = req.user;
  const user = await userDelete(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  Sendresponse(res, 200, "User deleted successfully");
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
