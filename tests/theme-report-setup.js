// globalSetup: ล้างผลย่อยของรอบก่อน (tests/theme-report/parts) — theme-report.js (globalTeardown) รวมเฉพาะผลของรอบนี้
const fs = require('fs');
const path = require('path');
module.exports = async function () {
  fs.rmSync(path.join(__dirname, 'theme-report', 'parts'), { recursive: true, force: true });
};
