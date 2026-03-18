const express = require("express");
const router = express.Router();

const { getMessages, sendMessage, markAsRead } = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/:conversationId", getMessages);
router.post("/send", sendMessage);
router.patch("/read/:conversationId", markAsRead);

module.exports = router;