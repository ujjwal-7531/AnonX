const express = require("express");
const router = express.Router();

const { updateNickname } = require("../controllers/conversationController");

router.patch("/:conversationId/nickname", updateNickname);

module.exports = router;