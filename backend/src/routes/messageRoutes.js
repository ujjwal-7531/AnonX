const express = require("express");
const router = express.Router();

const { getMessages, sendMessage } = require("../controllers/messageController");

router.get("/:conversationId", getMessages);
router.post("/send", sendMessage);

module.exports = router;