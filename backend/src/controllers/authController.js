const User = require("../models/User");
const OTP = require("../models/OTP");

const generateUserCode = require("../utils/generateUserCode");
const generateOTP = require("../utils/generateOTP");
const sendOTPEmail = require("../utils/sendOTPEmail");


// register user
const registerUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let user = await User.findOne({ email });

    // If user does not exist, create one
    if (!user) {
      const userCode = generateUserCode();

      user = new User({
        email,
        userCode,
        isVerified: false
      });

      await user.save();
    }

    // Generate OTP
    const otp = generateOTP();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP
    await OTP.create({
      email,
      otp,
      expiresAt
    });

    // Send OTP email
    await sendOTPEmail(email, otp);

    console.log(`OTP sent successfully to ${email}`)
    res.status(200).json({
      message: "OTP sent to email"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error: failed to send OTP"
    });
  }
};


// verify otp
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    await User.updateOne({ email }, { isVerified: true });

    await OTP.deleteMany({ email });

    console.log(`Email ${email} verified sucessfully`)
    res.status(200).json({ message: "Email verified successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


// login user
const loginUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Account does not exist" });
    }

    // If user not verified → send OTP again
    if (!user.isVerified) {

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await OTP.create({
        email,
        otp,
        expiresAt
      });

      await sendOTPEmail(email, otp);
      console.log(`Verify your email, OTP sent.`)
      return res.status(200).json({
        message: "Please verify your email. OTP sent."
      });
    }
    
    console.log(`ELogin successful`)
    res.status(200).json({
      message: "Login successful",
      userCode: user.userCode
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
  registerUser,
  verifyOTP,
  loginUser
};