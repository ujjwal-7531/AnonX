const express = require("express");
const router = express.Router();

const { getMessages, sendMessage, markAsRead } = require("../controllers/messageController");

router.get("/:conversationId", getMessages);
router.post("/send", sendMessage);
router.patch("/read/:conversationId", markAsRead);

module.exports = router;