const User = require("../models/User");
const Block = require("../models/Block");
const Conversation = require("../models/Conversation");
const generateAlias = require("../utils/generateAlias");

const searchUser = async (req, res) => {
  try {

    const { userCode } = req.params;
    const { currentUserCode } = req.body;

    if (!currentUserCode) {
      return res.status(400).json({
        message: "Current user code is required"
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

    // check if current user blocked target
    // const blockedByMe = await Block.findOne({
    //   blocker: currentUserCode,
    //   blocked: userCode
    // });

    // if (blockedByMe) {
    //   return res.status(403).json({
    //     message: "You have blocked this user"
    //   });
    // }

    // res.status(200).json({
    //   userCode: user.userCode
    // });

    // checks if conversation exists
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

    res.status(200).json({
        conversationId: conversation._id,
        alias: conversation.userA === currentUserCode
            ? conversation.aliasForA
            : conversation.aliasForB
    });

  } catch (error) {

    console.error("Search user error:", error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  searchUser
};