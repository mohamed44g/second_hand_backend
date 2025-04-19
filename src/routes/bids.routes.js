// routes/bids.routes.js
import express from "express";
import {
  addBid,
  getBids,
  placeBid,
  cancelBidController,
  finalizeAuctionController,
  getBidById,
  getBidHistoryById,
} from "../controllers/bids.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get("/", getBids);
router.get("/:bid_id", getBidById);
router.post("/", auth, addBid);
router.get("/:bid_id/history", auth, getBidHistoryById); 
router.post("/place", auth, placeBid);
router.post("/cancel", auth, cancelBidController);
router.post("/finalize/:bid_id", auth, finalizeAuctionController);

export default router;
