const User = require("../models/User");
const Block = require("../models/Block");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const OTP = require("../models/OTP");
const generateAlias = require("../utils/generateAlias");
const getISTDayEpoch = require("../utils/getISTDayEpoch");
const bcrypt = require("bcrypt");

const searchUser = async (req, res) => {
  try {

    const { userCode } = req.params;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    // Prevent searching yourself
    if (userCode === currentUserCode) {
      return res.status(400).json({
        message: "You cannot search your own ID"
      });
    }

    const user = await User.findOne({ userCode });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // check if target user blocked current user
    const blockedByTarget = await Block.findOne({
      blocker: userCode,
      blocked: currentUserCode
    });

    if (blockedByTarget) {
      return res.status(403).json({
        message: "You are blocked by this user"
      });
    }

    const codes = [currentUserCode, userCode].sort();
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
            aliasForB
        });

        await conversation.save();
    }

    const todayEpoch = getISTDayEpoch();

    res.status(200).json({
        conversationId: conversation._id,
        alias: conversation.userA === currentUserCode
            ? conversation.aliasForA
            : conversation.aliasForB,
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
    const { password } = req.body;

    if (!currentUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required to delete account"
      });
    }

    const user = await User.findOne({ userCode: currentUserCode });
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Incorrect password"
      });
    }

    const conversations = await Conversation.find({
      $or: [{ userA: currentUserCode }, { userB: currentUserCode }]
    }).select("_id");

    const conversationIds = conversations.map((conv) => conv._id);

    if (conversationIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
    }

    await Block.deleteMany({
      $or: [{ blocker: currentUserCode }, { blocked: currentUserCode }]
    });

    await OTP.deleteMany({ email: user.email });
    await User.deleteOne({ _id: user._id });

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
  searchUser,
  blockUser,
  unblockUser,
  deleteMyAccount
};