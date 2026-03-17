const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const updateNickname = async (req, res) => {
  try {

    const { conversationId } = req.params;
    const { currentUserCode, nickname } = req.body;

    if (!nickname) {
      return res.status(400).json({
        message: "Nickname is required"
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    if (conversation.userA === currentUserCode) {
      conversation.nicknameForA = nickname;
    } 
    else if (conversation.userB === currentUserCode) {
      conversation.nicknameForB = nickname;
    } 
    else {
      return res.status(403).json({
        message: "You are not part of this conversation"
      });
    }

    await conversation.save();

    res.status(200).json({
      message: "Nickname updated successfully"
    });

  } catch (error) {

    console.error("Update nickname error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

const getUserConversations = async (req, res) => {
  try {

    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({
        message: "User code is required"
      });
    }

    // find all conversations of user
    const conversations = await Conversation.find({
      $or: [
        { userA: userCode },
        { userB: userCode }
      ]
    });

    const result = [];

    for (let conv of conversations) {

      let displayName;
      let unreadCount = 0;

      // determine display name
      if (conv.userA === userCode) {
        displayName = conv.nicknameForA || conv.aliasForA;
      } else {
        displayName = conv.nicknameForB || conv.aliasForB;
      }

      // count unread messages
      unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        sender: { $ne: userCode },
        isRead: false
      });

      result.push({
        conversationId: conv._id,
        displayName,
        unreadCount
      });
    }

    res.status(200).json({
      conversations: result
    });

  } catch (error) {

    console.error("Fetch conversations error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  getUserConversations
};

module.exports = {
  updateNickname,
  getUserConversations
};