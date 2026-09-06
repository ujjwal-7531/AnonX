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
    maxlength: 1000
  },

  iv: {
    type: String,
    required: true
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

// Compound indexes for ultra-fast query performance
messageSchema.index({ conversationId: 1, timestamp: 1 });
messageSchema.index({ conversationId: 1, sender: 1, isRead: 1 });

module.exports = mongoose.model("Message", messageSchema);