import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { pool } from "./config/db.js";
const PORT = process.env.PORT || 5000;
import { createWriteStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
//routes
import userRouter from "./routes/user.routes.js";
import productsRouter from "./routes/products.routes.js";
import ReviewsRouter from "./routes/reviews.routes.js";
import bidsRouter from "./routes/bids.routes.js";
import walletRouter from "./routes/wallet.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import sponsoredAdsRoutes from "./routes/sponsoredAds.routes.js";
import reportsRouter from "./routes/report.routes.js";
import adminRouter from "./routes/admin.routes.js";

import AppError from "./utils/AppError.js";
import AsyncWrapper from "./middlewares/errorWrapper.middleware.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // أضف رابط الـ Frontend هنا
    methods: ["GET", "POST"],
  },
});

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // الانضمام إلى غرفة الشات بناءً على chat_id
  socket.on("join_chat", (chat_id) => {
    socket.join(chat_id);
    console.log(`User ${socket.id} joined chat ${chat_id}`);
  });

  // استقبال رسالة جديدة وتخزينها في قاعدة البيانات
  socket.on("send_message", async (data) => {
    const { chat_id, sender_id, message_text } = data;
    try {
      const result = await pool.query(
        `INSERT INTO Messages (chat_id, sender_id, message_text)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [chat_id, sender_id, message_text]
      );
      const newMessage = result.rows[0];

      // إرسال الرسالة لكل المستخدمين في الغرفة
      socket.broadcast.to(chat_id).emit("receive_message", newMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Middleware لإضافة Socket.IO لكل Request
app.use((req, res, next) => {
  req.io = io;
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
// إعداد Morgan بناءً على البيئة
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  const accessLogStream = createWriteStream(
    join(__dirname, "logs/access.log"),
    { flags: "a" }
  );
  app.use(morgan("combined", { stream: accessLogStream }));
}

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }, // secure: true في الإنتاج
  })
);

// Default Route GET (/)
app.get("/api/v1/", (req, res) => {
  res.send("Hello in nodejs-app-starter");
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/reviews", ReviewsRouter);
app.use("/api/v1/bids", bidsRouter);
app.use("/api/v1/wallet", walletRouter);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/sponsored", sponsoredAdsRoutes);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/admin", adminRouter);

//erro handler middleware
app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.statusCode || 500).json({ message: err.message });
});

httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
export default app;
