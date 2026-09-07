const User = require("../models/User");
const Block = require("../models/Block");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const generateAlias = require("../utils/generateAlias");

const updatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!publicKey) {
      return res.status(400).json({ message: "PublicKey is required" });
    }

    await User.findOneAndUpdate(
      { userCode: currentUserCode },
      { publicKey }
    );

    res.status(200).json({ message: "Public key updated successfully" });
  } catch (error) {
    console.error("Update public key error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const getPublicKey = async (req, res) => {
  try {
    const { userCode } = req.params;
    const user = await User.findOne({ userCode }).select("publicKey");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ publicKey: user.publicKey });
  } catch (error) {
    console.error("Get public key error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const searchUser = async (req, res) => {
  try {
    const { userCode } = req.params;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const queryStr = (userCode || "").trim();
    if (!queryStr) {
      return res.status(400).json({ message: "Search term is required" });
    }

    // Support searching by either 6-char userCode OR username
    const targetUser = await User.findOne({
      $or: [
        { userCode: queryStr },
        { username: queryStr.toLowerCase() }
      ]
    });

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const targetUserCode = targetUser.userCode;

    // Prevent searching yourself
    if (targetUserCode === currentUserCode) {
      return res.status(400).json({
        message: "You cannot search your own account"
      });
    }

    // Check if target user blocked current user
    const blockedByTarget = await Block.findOne({
      blocker: targetUserCode,
      blocked: currentUserCode
    });

    if (blockedByTarget) {
      return res.status(403).json({
        message: "You are blocked by this user"
      });
    }

    const codes = [currentUserCode, targetUserCode].sort();
    const conversationKey = `${codes[0]}_${codes[1]}`;

    let conversation = await Conversation.findOne({ conversationKey });

    if (!conversation) {
      const aliasForA = generateAlias();
      const aliasForB = generateAlias();

      conversation = new Conversation({
        conversationKey,
        userA: codes[0],
        userB: codes[1],
        aliasForA,
        aliasForB,
        lastMessageAt: new Date()
      });

      await conversation.save();
    }

    const now = new Date();
    const todayEpoch = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    const currentUser = await User.findOne({ userCode: currentUserCode });

    res.status(200).json({
      conversationId: conversation._id,
      alias: conversation.userA === currentUserCode
        ? conversation.aliasForA
        : conversation.aliasForB,
      targetUserCode,
      targetPublicKey: targetUser.publicKey,
      myPublicKey: currentUser?.publicKey || null,
      sentCount: conversation.userA === currentUserCode 
        ? ((!conversation.lastMessageEpochA || conversation.lastMessageEpochA.getTime() !== todayEpoch) ? 0 : (conversation.countAtoB || 0))
        : ((!conversation.lastMessageEpochB || conversation.lastMessageEpochB.getTime() !== todayEpoch) ? 0 : (conversation.countBtoA || 0))
    });

  } catch (error) {
    console.error("Search user error:", error.message);
    res.status(500).json({
      message: "Server error"
    });
  }
};

const blockUser = async (req, res) => {
  try {
    const { targetUserCode } = req.body;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode || !targetUserCode) {
      return res.status(400).json({
        message: "Both user codes are required"
      });
    }

    if (currentUserCode === targetUserCode) {
      return res.status(400).json({
        message: "You cannot block yourself"
      });
    }

    const existing = await Block.findOne({
      blocker: currentUserCode,
      blocked: targetUserCode
    });

    if (existing) {
      return res.status(400).json({
        message: "User already blocked"
      });
    }

    await Block.create({
      blocker: currentUserCode,
      blocked: targetUserCode
    });

    if (global.io) {
      global.io.to(currentUserCode).to(targetUserCode).emit("block_updated", {
        blocker: currentUserCode,
        targetUserCode,
        isBlocked: true
      });
    }

    res.status(200).json({
      message: "User blocked successfully"
    });

  } catch (error) {
    console.error("Block error:", error.message);
    res.status(500).json({
      message: "Server error"
    });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { targetUserCode } = req.body;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode || !targetUserCode) {
      return res.status(400).json({
        message: "Both user codes are required"
      });
    }

    const result = await Block.findOneAndDelete({
      blocker: currentUserCode,
      blocked: targetUserCode
    });

    if (!result) {
      return res.status(404).json({
        message: "Block record not found"
      });
    }

    if (global.io) {
      global.io.to(currentUserCode).to(targetUserCode).emit("block_updated", {
        blocker: currentUserCode,
        targetUserCode,
        isBlocked: false
      });
    }

    res.status(200).json({
      message: "User unblocked successfully"
    });

  } catch (error) {
    console.error("Unblock error:", error.message);
    res.status(500).json({
      message: "Server error"
    });
  }
};

const deleteMyAccount = async (req, res) => {
  try {
    const currentUserCode = req.user?.userCode;
    if (!currentUserCode) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await User.findOne({ userCode: currentUserCode });
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const conversations = await Conversation.find({
      $or: [{ userA: currentUserCode }, { userB: currentUserCode }]
    });

    const conversationIds = conversations.map((conv) => conv._id);

    if (conversationIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
    }

    await Block.deleteMany({
      $or: [{ blocker: currentUserCode }, { blocked: currentUserCode }]
    });

    await User.deleteOne({ _id: user._id });

    // Notify all active chat partners via socket
    if (global.io) {
      conversations.forEach((conv) => {
        const partnerCode = conv.userA === currentUserCode ? conv.userB : conv.userA;
        global.io.to(partnerCode).emit("user_deleted", { deletedUserCode: currentUserCode, conversationId: conv._id });
      });
      global.io.in(currentUserCode).disconnectSockets();
    }

    return res.status(200).json({
      message: "Account deleted permanently"
    });
  } catch (error) {
    console.error("Delete account error:", error.message);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  updatePublicKey,
  getPublicKey,
  searchUser,
  blockUser,
  unblockUser,
  deleteMyAccount
};