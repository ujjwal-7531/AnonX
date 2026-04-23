const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Block = require("../models/Block");
const getISTDayEpoch = require("../utils/getISTDayEpoch");

const updateNickname = async (req, res) => {
  try {

    const { conversationId } = req.params;
    const { nickname } = req.body;
    const currentUserCode = req.user?.userCode;

    if (!nickname) {
      return res.status(400).json({
        message: "Nickname is required"
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
    const currentUserCode = req.user?.userCode;

    if (!userCode || !currentUserCode) {
      return res.status(400).json({
        message: "User code is required"
      });
    }

    if (userCode !== currentUserCode) {
      return res.status(403).json({
        message: "You can only view your own conversations"
      });
    }

    // find all conversations of user
    const conversations = await Conversation.find({
      $or: [
        { userA: currentUserCode },
        { userB: currentUserCode }
      ]
    });

    const result = [];

    for (let conv of conversations) {

      let displayName;
      let unreadCount = 0;

      let targetUserCode;
      let sentCount = 0;

      // determine display name and target user
      const todayEpoch = getISTDayEpoch();
      if (conv.userA === currentUserCode) {
        displayName = conv.nicknameForA || conv.aliasForA;
        targetUserCode = conv.userB;
        sentCount = (!conv.lastMessageEpochA || conv.lastMessageEpochA.getTime() !== todayEpoch) ? 0 : (conv.countAtoB || 0);
      } else {
        displayName = conv.nicknameForB || conv.aliasForB;
        targetUserCode = conv.userA;
        sentCount = (!conv.lastMessageEpochB || conv.lastMessageEpochB.getTime() !== todayEpoch) ? 0 : (conv.countBtoA || 0);
      }

      // count unread messages
      unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        sender: { $ne: currentUserCode },
        isRead: false
      });

      const isBlockedRecord = await Block.findOne({ blocker: userCode, blocked: targetUserCode });

      result.push({
        conversationId: conv._id,
        displayName,
        unreadCount,
        targetUserCode,
        isBlocked: !!isBlockedRecord,
        sentCount
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
  updateNickname,
  getUserConversations
};