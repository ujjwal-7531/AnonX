const users = new Map();

const chatSocket = (io) => {

  io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    // register user
    socket.on("register_user", (userCode) => {
      users.set(userCode, socket.id);
      socket.join(userCode); // Make user listen to their persistent unified inbox globally
      console.log(`User ${userCode} registered and joined private global namespace ${socket.id}`);
    });

    // join conversation room
    socket.on("join_conversation", (conversationId) => {

      socket.join(conversationId);

      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);

    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (let [userCode, socketId] of users.entries()) {
        if (socketId === socket.id) {
          users.delete(userCode);
          break;
        }
      }
    });

  });

};

module.exports = chatSocket;