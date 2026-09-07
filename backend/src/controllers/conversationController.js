const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Block = require("../models/Block");
const User = require("../models/User");

const updateNickname = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { nickname } = req.body;
    const currentUserCode = req.user?.userCode;

    if (!nickname) {
      return res.status(400).json({ message: "Nickname is required" });
    }

    if (!currentUserCode) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.userA === currentUserCode) {
      conversation.nicknameForA = nickname;
    } else if (conversation.userB === currentUserCode) {
      conversation.nicknameForB = nickname;
    } else {
      return res.status(403).json({ message: "You are not part of this conversation" });
    }

    await conversation.save();

    const targetUserCode = conversation.userA === currentUserCode ? conversation.userB : conversation.userA;
    if (global.io) {
      global.io.to(currentUserCode).to(targetUserCode).emit("nickname_updated", {
        conversationId: conversation._id,
        userCode: currentUserCode,
        nickname
      });
    }

    res.status(200).json({ message: "Nickname updated successfully" });
  } catch (error) {
    console.error("Update nickname error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const getUserConversations = async (req, res) => {
  try {
    const { userCode } = req.params;
    const currentUserCode = req.user?.userCode;

    if (!userCode || !currentUserCode) {
      return res.status(400).json({ message: "User code is required" });
    }

    if (userCode !== currentUserCode) {
      return res.status(403).json({ message: "You can only view your own conversations" });
    }

    // Find all conversations sorted by recency
    const conversations = await Conversation.find({
      $or: [{ userA: currentUserCode }, { userB: currentUserCode }]
    }).sort({ lastMessageAt: -1, createdAt: -1 });

    const currentUser = await User.findOne({ userCode: currentUserCode });
    const myPublicKey = currentUser?.publicKey || null;

    // Batch query unread counts and partner users in parallel
    const now = new Date();
    const todayEpoch = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    const result = await Promise.all(
      conversations.map(async (conv) => {
        let displayName;
        let targetUserCode;
        let sentCount = 0;

        if (conv.userA === currentUserCode) {
          displayName = conv.nicknameForA || conv.aliasForB;
          targetUserCode = conv.userB;
          sentCount = (!conv.lastMessageEpochA || conv.lastMessageEpochA.getTime() !== todayEpoch) ? 0 : (conv.countAtoB || 0);
        } else {
          displayName = conv.nicknameForB || conv.aliasForA;
          targetUserCode = conv.userA;
          sentCount = (!conv.lastMessageEpochB || conv.lastMessageEpochB.getTime() !== todayEpoch) ? 0 : (conv.countBtoA || 0);
        }

        const startOfToday = new Date(todayEpoch);

        const [unreadCount, isBlockedRecord, targetUser] = await Promise.all([
          Message.countDocuments({
            conversationId: conv._id,
            sender: { $ne: currentUserCode },
            isRead: false,
            timestamp: { $gte: startOfToday }
          }),
          Block.findOne({ blocker: userCode, blocked: targetUserCode }),
          User.findOne({ userCode: targetUserCode }).select("publicKey")
        ]);

        return {
          conversationId: conv._id,
          displayName,
          unreadCount,
          targetUserCode,
          targetPublicKey: targetUser?.publicKey || null,
          myPublicKey,
          isBlocked: !!isBlockedRecord,
          sentCount,
          lastMessageAt: conv.lastMessageAt || conv.createdAt
        };
      })
    );

    res.status(200).json({ conversations: result });
  } catch (error) {
    console.error("Fetch conversations error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  updateNickname,
  getUserConversations
};