import express from "express";
import multer from "multer";
import {
  addDevice,
  addMainCategory,
  addSubCategory,
  getCategories,
  getDevices,
  getDeviceById,
  getSeller,
  getSellerDevices,
  getDevicesByCategory,
  getDevicesBySubcategory,
  getDevicesBySearch,
  getLatestDevices,
} from "../controllers/products.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import upload from "../config/uploadConfig.js";

const router = express.Router();

router.get("/category", getCategories);
router.post("/addMainCategory", addMainCategory);
router.post("/addSubCategory", addSubCategory);

//products
router.get("/", getDevices);
router.post("/", auth, upload.array("file", 20), addDevice);
router.get("/latest", getLatestDevices);
router.get("/search", getDevicesBySearch);
router.get("/category", getCategories);
router.get("/category/:category_id", getDevicesByCategory);
router.get("/category/:category_id/:subcategory_id", getDevicesBySubcategory);
router.get("/:deviceId", getDeviceById);

//saller
router.get("/seller/:seller_Id", getSeller);
router.get("/seller/:seller_Id/devices", getSellerDevices);
export default router;
