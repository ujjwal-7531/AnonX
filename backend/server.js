const express = require("express");
const cors = require("cors");

// socket.io
const http = require("http");
const { Server } = require("socket.io");
const chatSocket = require("./src/sockets/chatSocket");

const connectDB = require("./src/config/db");
require("dotenv").config();
const authRoutes = require("./src/routes/authRoutes");
const rateLimit = require("express-rate-limit");
const userRoutes = require("./src/routes/userRoutes");
const messageRoutes = require("./src/routes/messageRoutes");
const conversationRoutes = require("./src/routes/conversationRoutes");

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

app.use("/auth", authLimiter);
app.use("/auth", authRoutes);

app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/conversations", conversationRoutes);

app.get("/", (req, res) => {
  res.send("AnonX backend running");
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  // app.listen(PORT, () => {
  //   console.log(`Server running on port ${PORT}`);
  // });
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*"
    }
  });
  global.io = io;
  chatSocket(io);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();