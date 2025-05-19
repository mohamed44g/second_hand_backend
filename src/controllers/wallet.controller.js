import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import {
  getWalletDb,
  addToWalletDb,
  withdrawFromWalletDb,
  getWalletHistoryDb,
} from "../models/wallet.model.js";
import AppError from "../utils/AppError.js";
import { Sendresponse } from "../utils/response.js";

//wallet
export const getWallet = AsyncWrapper(async (req, res, next) => {
  const userId = req.user.userId;
  const wallet = await getWalletDb(userId);
  if (!wallet) {
    return next(new AppError("Wallet not found", 404));
  }
  Sendresponse(res, 200, "Wallet retrieved successfully", wallet);
});

export const addToWallet = AsyncWrapper(async (req, res, next) => {
  const userId = req.user.userId;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return next(new AppError("Invalid amount", 400));
  }

  const wallet = await addToWalletDb(userId, amount);
  if (!wallet) {
    return next(new AppError("Failed to add amount to wallet", 500));
  }

  Sendresponse(res, 200, "Amount added to wallet successfully");
});
export const withdrawFromWallet = AsyncWrapper(async (req, res, next) => {
  const userId = req.user.userId;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return next(new AppError("Invalid amount", 400));
  }

  const wallet = await withdrawFromWalletDb(userId, amount);
  if (!wallet) {
    return next(new AppError("Failed to withdraw amount from wallet", 500));
  }

  Sendresponse(res, 200, "Amount withdrawn from wallet successfully");
});

export const getWalletHistory = AsyncWrapper(async (req, res, next) => {
  const userId = req.user.userId;
  const walletHistory = await getWalletHistoryDb(userId);
  if (!walletHistory) {
    return next(new AppError("Wallet history not found", 404));
  }
  Sendresponse(
    res,
    200,
    "Wallet history retrieved successfully",
    walletHistory
  );
});

