require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  // Always log OTP to backend console for instant testing & log inspection
  console.log(`\n========================================`);
  console.log(`🔑 [OTP Code for ${email}]: ${otp}`);
  console.log(`========================================\n`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[Nodemailer Warning] EMAIL_USER or EMAIL_PASS environment variables are not configured in deployment dashboard.`);
    console.warn(`[Note] Use the OTP printed above from backend logs.`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    const mailOptions = {
      from: `"AnonX" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "AnonX Login Verification Code",
      text: `Your AnonX verification code is ${otp}. It is valid for 5 minutes.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Nodemailer] Email sent successfully to ${email} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`[Nodemailer Error] Failed to send email to ${email}:`, error.message);
    console.warn(`[Note] Check backend deployment logs for [OTP Code] to complete verification.`);
  }
};

module.exports = sendOTPEmail;