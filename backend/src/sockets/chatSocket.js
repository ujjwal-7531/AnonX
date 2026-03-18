const jwt = require("jsonwebtoken");
const users = new Map();

const chatSocket = (io) => {

  // Cryptographically authenticate websockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: No Token Provided"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "anonx_super_secret");
      socket.userCode = decoded.userCode; // Securely attach verified identity natively to socket
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid or Expired JWT"));
    }
  });

  io.on("connection", (socket) => {
    const userCode = socket.userCode;
    
    // Automatically register user natively through their JWT signature
    users.set(userCode, socket.id);
    socket.join(userCode);
    console.log(`User ${userCode} securely authenticated and joined global namespace ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Authenticated user ${userCode} disconnected:`, socket.id);
      if (users.get(userCode) === socket.id) {
        users.delete(userCode);
      }
    });

  });

};

module.exports = chatSocket;