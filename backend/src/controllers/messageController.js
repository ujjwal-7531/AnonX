const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const Block = require("../models/Block");

const getMessages = async (req, res) => {
  try {

    const { conversationId } = req.params;
    const currentUserCode = req.user?.userCode;

    if (!currentUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    if (conversation.userA !== currentUserCode && conversation.userB !== currentUserCode) {
      return res.status(403).json({
        message: "You are not part of this conversation"
      });
    }

    const messages = await Message.find({ conversationId })
      .sort({ timestamp: 1 });

    res.status(200).json({
      messages
    });

  } catch (error) {

    console.error("Fetch messages error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

const sendMessage = async (req, res) => {
  try {

    const { conversationId, messageText } = req.body;
    const senderUserCode = req.user?.userCode;

    if (!conversationId || !messageText) {
      return res.status(400).json({
        message: "conversationId and messageText are required"
      });
    }

    if (!senderUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    if (messageText.length > 250) {
      return res.status(400).json({
        message: "Message exceeds 250 character limit"
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    const { userA, userB } = conversation;

    if (senderUserCode !== userA && senderUserCode !== userB) {
      return res.status(403).json({
        message: "You are not part of this conversation"
      });
    }

    const receiverUserCode =
      senderUserCode === userA ? userB : userA;

    // block check
    const blockedByMe = await Block.findOne({
        blocker: senderUserCode,
        blocked: receiverUserCode
    });

    const blockedByThem = await Block.findOne({
        blocker: receiverUserCode,
        blocked: senderUserCode
    });

    if (blockedByThem) {
        return res.status(403).json({
            message: "You are blocked by this user"
        });
    }

    if (blockedByMe) {
        return res.status(403).json({
            message: "You have blocked this user"
        });
    }

    // message limit check
    const now = new Date();
    const todayEpoch = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    if (senderUserCode === userA) {
      if (!conversation.lastMessageEpochA || conversation.lastMessageEpochA.getTime() !== todayEpoch) {
        conversation.countAtoB = 0;
      }
      if (conversation.countAtoB >= 30) {
        return res.status(403).json({
          message: "You reached the daily message limit for this user"
        });
      }
    } else {
      if (!conversation.lastMessageEpochB || conversation.lastMessageEpochB.getTime() !== todayEpoch) {
        conversation.countBtoA = 0;
      }
      if (conversation.countBtoA >= 30) {
        return res.status(403).json({
          message: "You reached the daily message limit for this user"
        });
      }
    }

    const message = new Message({
      conversationId,
      sender: senderUserCode,
      messageText
    });

    // Target exactly the two users' private encrypted rooms for bulletproof global delivery
    // We include conversation details so receiving frontend can immediately show names without refresh
    const messagePayload = {
      ...message.toObject(),
      userA,
      userB,
      aliasForA: conversation.aliasForA,
      aliasForB: conversation.aliasForB
    };

    global.io.to(userA).to(userB).emit("receive_message", messagePayload);
    await message.save();

    // update counters
    if (senderUserCode === userA) {
      conversation.countAtoB += 1;
      conversation.lastMessageEpochA = new Date(todayEpoch);
    } else {
      conversation.countBtoA += 1;
      conversation.lastMessageEpochB = new Date(todayEpoch);
    }

    await conversation.save();

    res.status(201).json({
      message: "Message sent",
      data: message
    });

  } catch (error) {

    console.error("Send message error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

const markAsRead = async (req, res) => {
  try {

    const { conversationId } = req.params;
    const currentUserCode = req.user?.userCode;

    if (!conversationId) {
      return res.status(400).json({
        message: "conversationId is required"
      });
    }

    if (!currentUserCode) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    if (conversation.userA !== currentUserCode && conversation.userB !== currentUserCode) {
      return res.status(403).json({
        message: "You are not part of this conversation"
      });
    }

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: currentUserCode },
        isRead: false
      },
      {
        isRead: true
      }
    );

    res.status(200).json({
      message: "Messages marked as read"
    });

  } catch (error) {

    console.error("Mark read error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markAsRead
};