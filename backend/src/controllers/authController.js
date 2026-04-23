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

const createAndSendOTP = async ({ email, passwordHash }) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.deleteMany({ email });
  await OTP.create({
    email,
    otp: hashedOtp,
    password: passwordHash,
    expiresAt,
    attempts: 0
  });
  await sendOTPEmail(email, otp);
};


// register user
const registerUser = async (req, res) => {
  try {
    let { email,password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const existingOTP = await OTP.findOne({ email });
    const remainingCooldown = getRemainingCooldownSeconds(existingOTP);

    if (remainingCooldown > 0) {
      return res.status(429).json({
        message: `OTP already sent. Please wait ${remainingCooldown} seconds before requesting another.`
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await createAndSendOTP({ email, passwordHash: hashedPassword });

    console.log(`OTP sent successfully to ${email}`);

    res.status(200).json({
      message: "OTP sent to email"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error while sending OTP"
    });
  }
};


// verify otp
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
        message: "OTP not found. Please request a new OTP."
      });
    }

    // OTP expired
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteMany({ email });

      return res.status(400).json({
        message: "OTP expired. Please request a new OTP."
      });
    }

    // attempt limit check
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      await OTP.deleteMany({ email });

      return res.status(429).json({
        message: "Too many incorrect attempts. Request a new OTP."
      });
    }

    // wrong OTP
    const isValidOTP = await bcrypt.compare(otp.toString().trim(), otpRecord.otp);
    if (!isValidOTP) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // create user after verification
    const userCode =await generateUserCode();

    const newUser = new User({
      email,
      password: otpRecord.password,
      userCode,
      isVerified: true
    });

    await newUser.save();
    await OTP.deleteMany({ email });

    console.log(`Email ${email} verified successfully`);

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server auth misconfiguration" });
    }

    const token = jwt.sign(
      { userCode },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "Email verified and account created",
      userCode,
      token
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
};

const resendOTP = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    email = email.trim().toLowerCase();
    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }

    const user = await User.findOne({ email });
    if (user?.isVerified) {
      return res.status(409).json({
        message: "Email already verified. Please login."
      });
    }

    const existingOTP = await OTP.findOne({ email });
    if (!existingOTP) {
      return res.status(400).json({
        message: "OTP session not found. Please sign up again."
      });
    }

    const remainingCooldown = getRemainingCooldownSeconds(existingOTP);
    if (remainingCooldown > 0) {
      return res.status(429).json({
        message: `OTP already sent. Please wait ${remainingCooldown} seconds before requesting another.`
      });
    }

    const passwordHash = existingOTP.password || user?.password;
    if (!passwordHash) {
      return res.status(400).json({
        message: "OTP session not found. Please sign up again."
      });
    }

    await createAndSendOTP({ email, passwordHash });

    return res.status(200).json({
      message: "OTP resent successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while resending OTP"
    });
  }
};


// login user
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Account does not exist"
      });
    }

    // user not verified → resend OTP
    if (!user.isVerified) {

      const existingOTP = await OTP.findOne({ email });
      const remainingCooldown = getRemainingCooldownSeconds(existingOTP);

      if (remainingCooldown > 0) {
        return res.status(429).json({
          message: `OTP already sent. Please wait ${remainingCooldown} seconds before requesting another.`
        });
      }

      await createAndSendOTP({ email, passwordHash: user.password });

      console.log(`Verification OTP sent to ${email}`);

      return res.status(200).json({
        message: "Please verify your email. OTP sent."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    console.log(`Login successful for ${email}`);

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server auth misconfiguration" });
    }

    const token = jwt.sign(
      { userCode: user.userCode },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: "Login successful",
      userCode: user.userCode,
      token
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
};


module.exports = {
  registerUser,
  verifyOTP,
  loginUser,
  resendOTP
};