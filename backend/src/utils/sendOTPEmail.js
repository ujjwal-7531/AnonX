require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  // Always log OTP to backend console for instant developer testing
  console.log(`\n========================================`);
  console.log(`🔑 [DEV OTP for ${email}]: ${otp}`);
  console.log(`========================================\n`);

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
  } catch (error) {
    console.warn(`[Nodemailer Warning] Could not send email to ${email}:`, error.message);
    console.warn(`[Note] Use the DEV OTP printed above in the console to complete testing.`);
  }
};

module.exports = sendOTPEmail;