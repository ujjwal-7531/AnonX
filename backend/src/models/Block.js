const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
  blocker: {
    type: String,
    required: true
  },

  blocked: {
    type: String,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Block", blockSchema);