import express from "express";
import {
  createSponsoredAd,
  getActiveSponsoredAds,
  getUserSponsoredAds,
} from "../controllers/sponsoredAds.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getActiveSponsoredAds);
router.post("/", auth, createSponsoredAd);
router.get("/user", auth, getUserSponsoredAds);

export default router;
