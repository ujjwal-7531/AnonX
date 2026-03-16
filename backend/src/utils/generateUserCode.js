const User = require("../models/User");

const generateUserCode = async () => {
  const chars = "nopqrstuvwxyz01234ABCDEFGHIJKLMabcdefghijklm56789NOPQRSTUVWXYZ";

  while (true) {

    let code = "";

    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }

    const existingUser = await User.findOne({ userCode: code });

    if (!existingUser) {
      return code;
    }
  }
}

module.exports = generateUserCode;