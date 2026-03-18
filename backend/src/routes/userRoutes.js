const express = require("express");
const router = express.Router();

const { searchUser, blockUser, unblockUser } = require("../controllers/userController");

router.get("/search/:userCode", searchUser);
router.post("/block", blockUser);
router.post("/unblock", unblockUser);

module.exports = router;