const User = require("../models/User");
const OTP = require("../models/OTP");

const generateUserCode = require("../utils/generateUserCode");
const generateOTP = require("../utils/generateOTP");
const validateEmail = require("../utils/validateEmail");
const sendOTPEmail = require("../utils/sendOTPEmail");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


// register user
const registerUser = async (req, res) => {
  try {
    let { email,password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // check if OTP already sent recently
    const existingOTP = await OTP.findOne({ email });

    if (existingOTP && existingOTP.expiresAt > new Date()) {
      return res.status(429).json({
        message: "OTP already sent. Please wait before requesting another."
      });
    }

    // delete old OTPs
    await OTP.deleteMany({ email });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.create({
      email,
      otp,
      password: hashedPassword,
      expiresAt,
      attempts: 0
    });
    await sendOTPEmail(email, otp);

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
    if (otpRecord.attempts >= 5) {
      await OTP.deleteMany({ email });

      return res.status(429).json({
        message: "Too many incorrect attempts. Request a new OTP."
      });
    }

    // wrong OTP
    if (otpRecord.otp !== otp) {
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

    const token = jwt.sign(
      { userCode }, 
      process.env.JWT_SECRET || "anonx_super_secret", 
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
      message: "Server error",
      error: error
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

      if (existingOTP && existingOTP.expiresAt > new Date()) {
        return res.status(429).json({
          message: "OTP already sent. Please wait before requesting another."
        });
      }

      await OTP.deleteMany({ email });

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await OTP.create({
        email,
        otp,
        password: user.password,
        expiresAt,
        attempts: 0
      });

      await sendOTPEmail(email, otp);

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

    const token = jwt.sign(
      { userCode: user.userCode }, 
      process.env.JWT_SECRET || "anonx_super_secret", 
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
  loginUser
};