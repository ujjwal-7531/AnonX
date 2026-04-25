const jwt = require("jsonwebtoken");
const Conversation = require("../models/Conversation");

const chatSocket = (io) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for socket auth");
  }

  // Cryptographically authenticate websockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: No Token Provided"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userCode = decoded.userCode; // Securely attach verified identity natively to socket
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid or Expired JWT"));
    }
  });

  io.on("connection", (socket) => {
    const userCode = socket.userCode;
    socket.join(userCode);
    console.log(`User ${userCode} securely authenticated and joined global namespace ${socket.id}`);

    const emitTypingState = async (eventName, payload = {}) => {
      try {
        const { conversationId } = payload;
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId).select("userA userB");
        if (!conversation) return;

        if (conversation.userA !== userCode && conversation.userB !== userCode) return;

        const targetUserCode = conversation.userA === userCode ? conversation.userB : conversation.userA;
        if (!targetUserCode) return;

        io.to(targetUserCode).emit(eventName, {
          conversationId,
          sender: userCode
        });
      } catch (error) {
        console.error(`${eventName} socket error:`, error.message);
      }
    };

    socket.on("typing", (payload) => {
      emitTypingState("typing", payload);
    });

    socket.on("stop_typing", (payload) => {
      emitTypingState("stop_typing", payload);
    });

    socket.on("disconnect", () => {
      console.log(`Authenticated user ${userCode} disconnected:`, socket.id);
    });

  });

};

module.exports = chatSocket;