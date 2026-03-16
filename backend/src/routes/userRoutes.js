const express = require("express");
const router = express.Router();

const { searchUser } = require("../controllers/userController");

router.get("/search/:userCode", searchUser);

module.exports = router;