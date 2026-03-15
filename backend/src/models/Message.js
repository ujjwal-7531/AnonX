const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },

  sender: {
    type: String,
    required: true
  },

  messageText: {
    type: String,
    required: true,
    maxlength: 250
  },

  timestamp: {
    type: Date,
    default: Date.now
  },

  isRead: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Message", messageSchema);