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

// Fast lookup index
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);