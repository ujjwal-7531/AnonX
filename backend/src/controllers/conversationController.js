const Conversation = require("../models/Conversation");

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

module.exports = {
  updateNickname
};