const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const Block = require("../models/Block");

const getMessages = async (req, res) => {
  try {

    const { conversationId } = req.params;

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

    const { conversationId, senderUserCode, messageText } = req.body;

    if (!conversationId || !senderUserCode || !messageText) {
      return res.status(400).json({
        message: "conversationId, senderUserCode and messageText are required"
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
    if (senderUserCode === userA && conversation.countAtoB >= 30) {
      return res.status(403).json({
        message: "You reached the message limit for this user"
      });
    }

    if (senderUserCode === userB && conversation.countBtoA >= 30) {
      return res.status(403).json({
        message: "You reached the message limit for this user"
      });
    }

    const message = new Message({
      conversationId,
      sender: senderUserCode,
      messageText
    });

    // Target exactly the two users' private encrypted rooms for bulletproof global delivery
    global.io.to(userA).to(userB).emit("receive_message", message);
    await message.save();

    // update counters
    if (senderUserCode === userA) {
      conversation.countAtoB += 1;
    } else {
      conversation.countBtoA += 1;
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
    const { currentUserCode } = req.body;

    if (!conversationId || !currentUserCode) {
      return res.status(400).json({
        message: "conversationId and currentUserCode are required"
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