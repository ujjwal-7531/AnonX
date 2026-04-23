const IST_OFFSET_MINUTES = 330;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getISTDayEpoch = () => {
  const now = Date.now();
  const istNowMs = now + IST_OFFSET_MINUTES * ONE_MINUTE_MS;
  const istDayStartMs = Math.floor(istNowMs / ONE_DAY_MS) * ONE_DAY_MS;
  return istDayStartMs - IST_OFFSET_MINUTES * ONE_MINUTE_MS;
};

module.exports = getISTDayEpoch;
