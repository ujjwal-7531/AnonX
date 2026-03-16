const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
require("dotenv").config();
const authRoutes = require("./src/routes/authRoutes");
const rateLimit = require("express-rate-limit");
const userRoutes = require("./routes/userRoutes");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    message: "Too many requests. Please try again later."
  }
});
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(limiter);
app.use("/auth", authRoutes);
app.use("/auth", authLimiter);
app.use("/users", userRoutes);

app.get("/", (req, res) => {
  res.send("AnonX backend running");
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();