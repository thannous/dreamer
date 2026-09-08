'use strict';
const fs = require('node:fs');
function readLocalStatus(file) {
  if (!file) throw new Error('TI528_LOCAL_STATUS must point to the private status JSON; no qualification was run');
  const status = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = new URL(status.DB_URL);
  if (status.API_URL !== 'http://127.0.0.1:55321' ||
    !['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' ||
    db.port !== '55322' || db.pathname !== '/postgres' || db.search || db.hash) {
    throw new Error('Requires isolated TI-528 localhost ports and database');
  }
  return status;
}
module.exports = { readLocalStatus };
