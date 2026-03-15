function generateAlias() {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `Anon${number}`;
}

module.exports = generateAlias;