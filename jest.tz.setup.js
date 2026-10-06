// Runs once in the parent process before workers start; workers inherit TZ.
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
