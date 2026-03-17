const express = require("express");
const router = express.Router();

const { updateNickname, getUserConversations } = require("../controllers/conversationController");

router.patch("/:conversationId/nickname", updateNickname);
router.get("/:userCode", getUserConversations);

module.exports = router;