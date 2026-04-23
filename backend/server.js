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

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Strict CORS Origin Block: Access Denied'));
    }
  },
  credentials: true
}));
app.use(express.json());

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
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });
  global.io = io;
  chatSocket(io);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();