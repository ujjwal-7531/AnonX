require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
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
    subject: "AnonX Email Verification OTP",
    text: `Your OTP is ${otp}. It is valid for 5 minutes.`
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendOTPEmail;