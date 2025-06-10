import express from "express";
import {
  createSponsoredAd,
  getActiveSponsoredAds,
  getUserSponsoredAds,
} from "../controllers/sponsoredAds.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";

const router = express.Router();

router.get("/", auth, authorizeRoles("admin"), getActiveSponsoredAds);
router.post("/", auth, authorizeRoles("seller"), createSponsoredAd);
router.get(
  "/user",
  auth,
  authorizeRoles("admin", "seller"),
  getUserSponsoredAds
);

export default router;
