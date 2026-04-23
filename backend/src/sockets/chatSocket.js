const jwt = require("jsonwebtoken");

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

    socket.on("disconnect", () => {
      console.log(`Authenticated user ${userCode} disconnected:`, socket.id);
    });

  });

};

module.exports = chatSocket;