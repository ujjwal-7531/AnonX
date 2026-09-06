const User = require("../models/User");
const OTP = require("../models/OTP");
const generateUserCode = require("../utils/generateUserCode");
const generateOTP = require("../utils/generateOTP");
const validateEmail = require("../utils/validateEmail");
const sendOTPEmail = require("../utils/sendOTPEmail");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const OTP_EXPIRY_MINUTES = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

const getRemainingCooldownSeconds = (otpRecord) => {
  if (!otpRecord?.createdAt) return 0;
  const elapsedSeconds = Math.floor((Date.now() - new Date(otpRecord.createdAt).getTime()) / 1000);
  return Math.max(0, OTP_COOLDOWN_SECONDS - elapsedSeconds);
};

// Send OTP to email (Unified for Login & Register)
const sendOTP = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingOTP = await OTP.findOne({ email });
    const remainingCooldown = getRemainingCooldownSeconds(existingOTP);

    if (remainingCooldown > 0) {
      return res.status(429).json({
        message: `OTP already sent. Please wait ${remainingCooldown} seconds before requesting another.`
      });
    }

    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OTP.deleteMany({ email });
    await OTP.create({
      email,
      otp: hashedOtp,
      expiresAt,
      attempts: 0
    });

    await sendOTPEmail(email, otp);

    console.log(`[Auth] OTP sent to ${email}`);

    res.status(200).json({
      message: "Verification code sent to email"
    });

  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      message: "Server error while sending verification code"
    });
  }
};

// Verify OTP & Authenticate (Unified Passwordless Flow)
const verifyOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }

    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Code not found or expired. Please request a new code."
      });
    }

    // OTP expired check
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteMany({ email });
      return res.status(400).json({
        message: "Verification code expired. Please request a new one."
      });
    }

    // Attempt limit check
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      await OTP.deleteMany({ email });
      return res.status(429).json({
        message: "Too many incorrect attempts. Please request a new code."
      });
    }

    // Compare OTP hash
    const isValidOTP = await bcrypt.compare(otp.toString().trim(), otpRecord.otp);
    if (!isValidOTP) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        message: "Invalid verification code"
      });
    }

    // Retrieve existing user or create a new one
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const userCode = await generateUserCode();
      user = new User({
        email,
        userCode,
        isVerified: true
      });
      await user.save();
    } else if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Delete used OTP
    await OTP.deleteMany({ email });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server auth misconfiguration" });
    }

    // Issue JWT token (7-day duration)
    const token = jwt.sign(
      { userCode: user.userCode },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Auth] ${isNewUser ? "Created new user" : "Logged in user"} ${email} (${user.userCode})`);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? "Account created successfully" : "Welcome back",
      userCode: user.userCode,
      token
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      message: "Server error during verification"
    });
  }
};

module.exports = {
  sendOTP,
  registerUser: sendOTP, // Alias for backward compatibility
  verifyOTP,
  loginUser: sendOTP,    // Alias for backward compatibility
  resendOTP: sendOTP
};