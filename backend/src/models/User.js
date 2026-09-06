const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30
  },

  password: {
    type: String,
    required: true
  },

  userCode: {
    type: String,
    required: true,
    unique: true,
    minlength: 6,
    maxlength: 6
  },

  publicKey: {
    type: String,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);