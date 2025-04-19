// controllers/bids.controllers.js
import {
  createBid,
  getAllBids,
  addBidToHistory,
  getBidHistoryByIdDb,
  getBidByIdDb,
  cancelBid,
  finalizeAuction,
} from "../models/bids.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";

export const getBids = AsyncWrapper(async (req, res, next) => {
  const bids = await getAllBids();
  Sendresponse(res, 200, "Bids fetched successfully", bids);
});

export const getBidById = AsyncWrapper(async (req, res, next) => {
  const { bid_id } = req.params;
  if (!bid_id) {
    return next(new AppError("Please provide bid_id", 400));
  }

  const bid = await getBidByIdDb(bid_id);
  if (!bid) {
    return next(new AppError("Bid not found", 404));
  }

  Sendresponse(res, 200, "Bid fetched successfully", bid);
});

export const getBidHistoryById = AsyncWrapper(async (req, res, next) => {
  const { bid_id } = req.params;
  if (!bid_id) {
    return next(new AppError("Please provide bid_id", 400));
  }

  const bidHistory = await getBidHistoryByIdDb(bid_id);
  if (!bidHistory) {
    return next(new AppError("Bid history not found", 404));
  }

  Sendresponse(res, 200, "Bid history fetched successfully", bidHistory);
});

export const addBid = AsyncWrapper(async (req, res, next) => {
  const { device_id, minimum_increment, auction_end_time } = req.body;
  const user_id = req.user.userId;

  console.log(req.body);

  if (!device_id || !minimum_increment || !auction_end_time) {
    return next(
      new AppError(
        "Please provide device_id, minimum_increment, auction_end_time",
        400
      )
    );
  }

  if (minimum_increment <= 0) {
    return next(
      new AppError(
        "Minimum increment must be greater than 0",
        400
      )
    );
  }

  const newBid = await createBid(
    device_id,
    user_id,
    minimum_increment,
    auction_end_time
  );

  Sendresponse(res, 201, "Bid added successfully", newBid);
});

export const placeBid = AsyncWrapper(async (req, res, next) => {
  const { bid_id, bid_amount } = req.body;
  const user_id = req.user.userId;

  if (!bid_id || !bid_amount) {
    return next(new AppError("Please provide bid_id and bid_amount", 400));
  }

  if (bid_amount <= 0) {
    return next(new AppError("Bid amount must be greater than 0", 400));
  }

  const bidHistoryEntry = await addBidToHistory(bid_id, user_id, bid_amount);

  Sendresponse(res, 201, "Bid placed successfully", bidHistoryEntry);
});

export const cancelBidController = AsyncWrapper(async (req, res, next) => {
  const { bid_id } = req.body;
  const user_id = req.user.userId;

  if (!bid_id) {
    return next(new AppError("Please provide bid_id", 400));
  }

  const result = await cancelBid(bid_id, user_id);

  Sendresponse(res, 200, "Bid canceled successfully", result);
});

export const finalizeAuctionController = AsyncWrapper(
  async (req, res, next) => {
    const { bid_id } = req.params;

    if (!bid_id) {
      return next(new AppError("Please provide bid_id", 400));
    }

    const result = await finalizeAuction(bid_id);

    Sendresponse(res, 200, "Auction finalized successfully", result);
  }
);
