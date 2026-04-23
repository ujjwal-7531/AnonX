const express = require("express");
const router = express.Router();

const { searchUser, blockUser, unblockUser, deleteMyAccount } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/search/:userCode", searchUser);
router.post("/block", blockUser);
router.post("/unblock", unblockUser);
router.delete("/me", deleteMyAccount);

module.exports = router;