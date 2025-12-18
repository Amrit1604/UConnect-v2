// Utility for running Jest from admin UI
const { exec } = require('child_process');

function runJest(cb) {
  exec('npm test -- --json --outputFile=jest-report.json', { cwd: process.cwd() }, (err, stdout, stderr) => {
    if (err) return cb(stderr || err.message);
    try {
      const report = require(process.cwd() + '/jest-report.json');
      cb(null, report);
    } catch (e) {
      cb('Could not parse Jest report.');
    }
  });
}

module.exports = runJest;
