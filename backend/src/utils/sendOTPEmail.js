require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[Nodemailer Warning] EMAIL_USER or EMAIL_PASS environment variables are missing.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "AnonX Login Verification Code",
      text: `Your AnonX verification code is ${otp}. It is valid for 5 minutes.`
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Nodemailer] OTP email sent successfully to ${email}`);
  } catch (error) {
    console.error(`[Nodemailer Error] Failed to send email to ${email}:`, error.message);
  }
};

module.exports = sendOTPEmail;