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
  deleteDevice,
  updateDevice,
  updateDeviceStatus,
  getPendingDevices,
} from "../controllers/products.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import upload from "../config/uploadConfig.js";
import { authorizeRoles } from "../middlewares/authorize.middlewares.js";

const router = express.Router();

router.get("/category", getCategories);

//products
router.get("/", getDevices);
router.get("/pending", auth, authorizeRoles("admin"), getPendingDevices);
router.get("/latest", getLatestDevices);
router.get("/search", getDevicesBySearch);
router.get("/category", getCategories);
router.get("/category/:category_id", getDevicesByCategory);
router.get("/category/:category_id/:subcategoryId", getDevicesBySubcategory);
router.get("/:deviceId", getDeviceById);

router.delete("/:deviceId", auth, authorizeRoles("seller"), deleteDevice);

//saller
router.get("/seller/:seller_Id", getSeller);
router.get("/seller/:seller_Id/devices", getSellerDevices);

//admin routes

router.post("/addMainCategory", auth, authorizeRoles("admin"), addMainCategory);
router.post("/addSubCategory", auth, authorizeRoles("admin"), addSubCategory);
router.post(
  "/",
  auth,
  authorizeRoles("seller"),
  upload.array("file", 20),
  addDevice
);
router.put(
  "/:deviceId",
  auth,
  authorizeRoles("seller"),
  upload.array("file", 20),
  updateDevice
);

router.patch("/:deviceId", auth, authorizeRoles("admin"), updateDeviceStatus);

export default router;
