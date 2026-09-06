const User = require("../models/User");
const generateUserCode = require("../utils/generateUserCode");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register new user with username and password
const register = async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    username = username.trim().toLowerCase();

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: "Username must be between 3 and 30 characters" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken. Please choose another." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = await generateUserCode();

    const user = new User({
      username,
      password: hashedPassword,
      userCode
    });

    await user.save();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server auth misconfiguration" });
    }

    const token = jwt.sign(
      { userCode: user.userCode },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[Auth] Registered new user '${username}' (${user.userCode})`);

    res.status(201).json({
      message: "Account created successfully",
      userCode: user.userCode,
      username: user.username,
      token
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Login user with username and password
const login = async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    username = username.trim().toLowerCase();

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server auth misconfiguration" });
    }

    const token = jwt.sign(
      { userCode: user.userCode },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[Auth] User '${username}' logged in (${user.userCode})`);

    res.status(200).json({
      message: "Welcome back!",
      userCode: user.userCode,
      username: user.username,
      token
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

module.exports = {
  register,
  login
};