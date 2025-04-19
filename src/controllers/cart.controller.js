// controllers/cart.controllers.js
import {
  addToCartDb,
  getCartItemsDb,
  removeFromCartDb,
} from "../models/cart.model.js";
import { Sendresponse } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";

export const addToCart = AsyncWrapper(async (req, res, next) => {
  const { device_id, quantity } = req.body;
  const user_id = req.user.userId;

  if (!device_id || !quantity || quantity <= 0) {
    return next(
      new AppError("Please provide device_id and a valid quantity", 400)
    );
  }

  const cartItem = await addToCartDb(user_id, device_id, quantity);
  Sendresponse(res, 201, "Item added to cart successfully", cartItem);
});

export const getCart = AsyncWrapper(async (req, res, next) => {
  const user_id = req.user.userId;
  const cartItems = await getCartItemsDb(user_id);
  Sendresponse(res, 200, "Cart fetched successfully", cartItems);
});

export const removeFromCart = AsyncWrapper(async (req, res, next) => {
  const { device_id } = req.body;
  const user_id = req.user.userId;

  if (!device_id) {
    return next(new AppError("Please provide device_id", 400));
  }

  const removedItem = await removeFromCartDb(user_id, device_id);
  Sendresponse(res, 200, "Item removed from cart successfully", removedItem);
});
