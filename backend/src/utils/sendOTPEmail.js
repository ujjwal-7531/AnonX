require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  // Always log OTP to backend console for instant developer testing & log inspection
  console.log(`\n========================================`);
  console.log(`🔑 [OTP Code for ${email}]: ${otp}`);
  console.log(`========================================\n`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[Nodemailer Warning] EMAIL_USER or EMAIL_PASS environment variables are not configured in your deployment dashboard.`);
    console.warn(`[Note] Add EMAIL_USER and EMAIL_PASS to your host's environment settings, or check host logs for the OTP.`);
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
      from: `"AnonX Verification" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `[${otp}] Your AnonX Verification Code`,
      text: `Your AnonX verification code is ${otp}. It is valid for 5 minutes.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #0f0f13; border: 1px solid #2e2a4a; border-radius: 12px; color: #ffffff;">
          <h2 style="color: #8b5cf6; margin-top: 0;">AnonX Verification Code</h2>
          <p style="color: #d1d5db; font-size: 15px;">Use the code below to complete your login or registration:</p>
          <div style="background-color: #1e1b4b; border: 1px solid #4338ca; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #c4b5fd;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">This code is valid for <strong>5 minutes</strong>. If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Nodemailer] Email sent successfully to ${email} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`[Nodemailer Error] Failed to send email to ${email}:`, error.message);
    console.warn(`[Note] Check backend deployment logs for [OTP Code] to complete verification.`);
  }
};

module.exports = sendOTPEmail;