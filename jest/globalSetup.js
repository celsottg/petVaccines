// Runs the whole suite in the timezone of the app's audience (Brazil),
// so date rules are tested against the local-day rollover (UTC-3).
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
