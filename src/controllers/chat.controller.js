// controllers/chat.controllers.js
import {
  getUserChatsDb,
  getChatMessagesDb,
  getChatDetailsDb,
  createChatDb,
} from "../models/chat.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";

export const startChatWithSeller = AsyncWrapper(async (req, res, next) => {
  const { seller_id } = req.body;
  const buyer_id = req.user.userId; // المشتري (المستخدم الحالي)

  if (!seller_id) {
    return next(new AppError("Seller ID is required", 400));
  }

  if (buyer_id === seller_id) {
    return next(new AppError("لا يمكنك بدا محادثة مع نفسك.", 400));
  }

  // إنشاء الشات
  const chat = await createChatDb(buyer_id, seller_id);
  Sendresponse(res, 201, "Chat created successfully", chat);
});

// جلب كل الشاتات بتاعة المستخدم
export const getUserChats = AsyncWrapper(async (req, res, next) => {
  const user_id = req.user.userId;
  const chats = await getUserChatsDb(user_id);
  Sendresponse(res, 200, "Chats fetched successfully", chats);
});

// جلب رسائل شات معين
export const getChatMessages = AsyncWrapper(async (req, res, next) => {
  const { chat_id } = req.params;
  const user_id = req.user.userId;
  const is_admin = req.user.is_admin;
  const messages = await getChatMessagesDb(chat_id, user_id, is_admin);
  Sendresponse(res, 200, "Messages fetched successfully", messages);
});

// جلب بيانات الشات
export const getChatDetails = AsyncWrapper(async (req, res, next) => {
  const { chat_id } = req.params;
  const user_id = req.user.userId;
  const is_admin = req.user.is_admin;
  const chatDetails = await getChatDetailsDb(chat_id, user_id, is_admin);
  Sendresponse(res, 200, "Chat details fetched successfully", chatDetails);
});
