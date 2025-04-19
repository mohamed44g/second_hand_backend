// routes/chat.routes.js
import express from "express";
import {
  getUserChats,
  getChatMessages,
  getChatDetails,
  startChatWithSeller,
} from "../controllers/chat.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", auth, getUserChats); // جلب كل الشاتات
router.get("/:chat_id/messages", auth, getChatMessages); // جلب رسائل شات
router.get("/:chat_id", auth, getChatDetails); // جلب بيانات الشات
router.post("/start", auth, startChatWithSeller);

export default router;
