const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  conversationKey: {
    type: String,
    required: true,
    unique: true
  },

  userA: {
    type: String,
    required: true
  },

  userB: {
    type: String,
    required: true
  },

  aliasForA: {
    type: String,
    required: true
  },

  aliasForB: {
    type: String,
    required: true
  },

  nicknameForA: {
    type: String,
    default: null
  },

  nicknameForB: {
    type: String,
    default: null
  },

  countAtoB: {
    type: Number,
    default: 0
  },

  countBtoA: {
    type: Number,
    default: 0
  },

  lastMessageEpochA: {
    type: Date,
    default: null
  },

  lastMessageEpochB: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Conversation", conversationSchema);