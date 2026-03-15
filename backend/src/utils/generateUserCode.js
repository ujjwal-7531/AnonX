function generateUserCode() {
  const chars = "nopqrstuvwxyz01234ABCDEFGHIJKLMabcdefghijklm56789NOPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

module.exports = generateUserCode;