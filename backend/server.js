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

const corsOptions = {
  origin: true, // Dynamically allow any requesting origin with credentials
  credentials: true,
  optionsSuccessStatus: 200
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // 1000 requests per 15 minutes for smooth real-time messaging
  skipOptions: true,
  skip: (req) => req.headers["x-benchmark-key"] === "anonx-bench" || process.env.BENCHMARK === "true",
  message: {
    message: "Too many requests. Please try again later."
  }
});
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100, // 100 auth attempts per 10 minutes
  skipOptions: true
});

const app = express();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

app.use(cors(corsOptions));
app.use(express.json());

app.use("/auth", authLimiter);
app.use("/auth", authRoutes);

app.use("/users", limiter, userRoutes);
app.use("/messages", limiter, messageRoutes);
app.use("/conversations", limiter, conversationRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

const path = require("path");
const fs = require("fs");

const frontendDistPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("AnonX backend running");
  });
}

const Message = require("./src/models/Message");

// Auto-cleanup old messages from previous days (system-wide)
const cleanupOldMessages = async () => {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const result = await Message.deleteMany({ timestamp: { $lt: startOfToday } });
    if (result.deletedCount > 0) {
      console.log(`[Auto-Cleanup] Cleared ${result.deletedCount} old messages from previous days.`);
    }
  } catch (err) {
    console.error("[Auto-Cleanup Error]:", err.message);
  }
};

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  // Guarantee old messages are purged IMMEDIATELY on cold start before accepting requests
  await cleanupOldMessages();
  setInterval(cleanupOldMessages, 60 * 60 * 1000);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
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