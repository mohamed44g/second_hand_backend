import AsyncWrapper from "../middlewares/errorWrapper.middleware.js";
import {
  getAllDevices,
  createDevice,
  getCategoriesDb,
  addMainCategoryDb,
  addSubcategoryDb,
  getDeviceByIdDb,
  getDevicesBySellerIdDb,
  getSellerByIdDb,
  getDevicesByCategoryDb,
  getDevicesBySubcategoryDb,
  getLatestDevicesDb,
  getDevicesBySearchDb,
} from "../models/products.model.js";
import { Sendresponse } from "../utils/response.js";
import { uploadImage } from "../utils/uploadImages.js";

export const addDevice = AsyncWrapper(async (req, res, next) => {
  const {
    name,
    description,
    main_category_id,
    subcategory_id,
    starting_price,
    current_price,
    condition,
    manufacturing_year,
    accessories,
    is_auction,
  } = req.body;

  let image_url = null;
  const seller_id = req.user.userId;

  if (req.file) {
    image_url = await uploadImage(req.file);
  }

  const newDevice = await createDevice(
    name,
    description,
    main_category_id,
    subcategory_id,
    starting_price,
    current_price,
    seller_id,
    image_url,
    condition,
    manufacturing_year,
    accessories,
    is_auction
  );

  Sendresponse(res, 201, "Device added successfully", {
    device: newDevice,
  });
});

export const getDevices = AsyncWrapper(async (req, res, next) => {
  const { mainCategory, subcategory, location, minPrice, maxPrice } = req.query;

  const filters = {
    mainCategory: mainCategory || undefined,
    subcategory: subcategory || undefined,
    location: location || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
  };

  const devices = await getAllDevices(filters);

  Sendresponse(res, 200, "Devices retrieved successfully", {
    devices,
  });
});

export const getDeviceById = AsyncWrapper(async (req, res, next) => {
  const { deviceId } = req.params;
  const device = await getDeviceByIdDb(deviceId);
  if (!device) {
    return next(new AppError("Device not found", 404));
  }
  Sendresponse(res, 200, "Device retrieved successfully", device);
});

export const getCategories = AsyncWrapper(async (req, res, next) => {
  const categories = await getCategoriesDb();
  Sendresponse(res, 200, "Categories retrieved successfully", categories);
});

export const addMainCategory = AsyncWrapper(async (req, res, next) => {
  const { main_category_name } = req.body;
  const newMainCategory = await addMainCategoryDb(main_category_name);
  Sendresponse(res, 201, "Main category added successfully", {
    mainCategory: newMainCategory,
  });
});

export const addSubCategory = AsyncWrapper(async (req, res, next) => {
  const { subcategory_name, main_category_id } = req.body;
  const newSubCategory = await addSubcategoryDb(
    subcategory_name,
    main_category_id
  );
  Sendresponse(res, 201, "Sub category added successfully", {
    subCategory: newSubCategory,
  });
});

export const getSeller = AsyncWrapper(async (req, res, next) => {
  const { seller_Id } = req.params;
  const seller = await getSellerByIdDb(seller_Id);
  if (!seller) {
    return next(new AppError("Seller not found", 404));
  }
  Sendresponse(res, 200, "Seller retrieved successfully", seller);
});

export const getSellerDevices = AsyncWrapper(async (req, res, next) => {
  const { seller_Id } = req.params;
  const devices = await getDevicesBySellerIdDb(seller_Id);
  if (!devices) {
    return next(new AppError("No devices found for this seller", 404));
  }
  Sendresponse(res, 200, "Seller devices retrieved successfully", devices);
});

export const getDevicesByCategory = AsyncWrapper(async (req, res, next) => {
  const { category_id } = req.params;
  const devices = await getDevicesByCategoryDb(category_id);
  if (!devices) {
    return next(new AppError("No devices found for this category", 404));
  }
  Sendresponse(res, 200, "Devices by category retrieved successfully", devices);
});

export const getDevicesBySubcategory = AsyncWrapper(async (req, res, next) => {
  const { subcategory_id } = req.params;
  const devices = await getDevicesBySubcategoryDb(subcategory_id);
  if (!devices) {
    return next(new AppError("No devices found for this subcategory", 404));
  }
  Sendresponse(
    res,
    200,
    "Devices by subcategory retrieved successfully",
    devices
  );
});

export const getLatestDevices = AsyncWrapper(async (req, res, next) => {
  const devices = await getLatestDevicesDb(4);
  if (!devices) {
    return next(new AppError("No latest devices found", 404));
  }
  Sendresponse(res, 200, "Latest devices retrieved successfully", devices);
});

export const getDevicesBySearch = AsyncWrapper(async (req, res, next) => {
  const { search } = req.query;
  const devices = await getDevicesBySearchDb(search);
  if (!devices) {
    return next(new AppError("No devices found for this search", 404));
  }
  Sendresponse(res, 200, "Devices by search retrieved successfully", devices);
});
