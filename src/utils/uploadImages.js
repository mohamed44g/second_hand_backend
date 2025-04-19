import AppError from "./AppError.js";
import axios from "axios";

export const uploadImage = async (image) => {
  const formData = new FormData();
  const bufferimage = image.buffer.toString("base64");
  formData.append("image", bufferimage);

  const url = `https://api.imgbb.com/1/upload?key=${"288719d727b5c9bb9beab1b13724aba7"}`;

  const response = await axios.post(url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (response.status == 200) {
    return response?.data?.data?.url;
  } else {
    throw new AppError("حدث خطأ اثناء تحميل الصورة", 500);
  }
};
