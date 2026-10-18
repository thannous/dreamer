const fs = require('node:fs');

function sameContents(source, destination) {
  try { return fs.readFileSync(source).equals(fs.readFileSync(destination)); }
  catch { return false; }
}

// Windows can briefly deny an atomic replacement while another writer/reader
// closes its handle. Keep the old file intact; a persistent failure still fails.
function replaceFile(source, destination, {
  rename = fs.renameSync,
  pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
  equivalent = sameContents,
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      rename(source, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
      // A concurrent generator may already have installed the exact bytes.
      // Do not contend for another replacement of that complete declaration.
      if (equivalent(source, destination)) return;
      if (attempt >= 49) throw error;
      pause(20);
    }
  }
}

module.exports = { replaceFile };
