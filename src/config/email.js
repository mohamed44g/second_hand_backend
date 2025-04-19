// config/email.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: "89d801001@smtp-brevo.com", // الإيميل بتاعك على Brevo
    pass: "FY2ytNLvTRhqQbUA", // الـ API Key بتاع Brevo
  },
});

export default transporter;
