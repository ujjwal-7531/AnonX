const express = require("express");
const router = express.Router();

const { updateNickname, getUserConversations } = require("../controllers/conversationController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.patch("/:conversationId/nickname", updateNickname);
router.get("/:userCode", getUserConversations);

module.exports = router;