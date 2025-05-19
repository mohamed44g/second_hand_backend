// routes/bids.routes.js
import express from "express";
import {
  addBid,
  getBids,
  placeBid,
  cancelBidController,
  cancelBidSellerController,
  finalizeAuctionController,
  getBidById,
  getBidHistoryById,
  getLatestAuctions,
} from "../controllers/bids.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";

const router = express.Router();
router.get("/", getBids);
router.get("/latest", getLatestAuctions);
router.post("/place", auth, placeBid);
router.post("/cancel", auth, cancelBidController);
router.get("/:bid_id", getBidById);
router.get("/:bid_id/history", auth, getBidHistoryById);
router.post("/", auth, authorizeRoles("seller"), addBid);
router.patch(
  "/cancel/:bid_id",
  auth,
  authorizeRoles("seller"),
  cancelBidSellerController
);
router.post(
  "/finalize/:bid_id",
  auth,
  authorizeRoles("seller"),
  finalizeAuctionController
);

export default router;
