const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function probeMedia(filePath) {
  const output = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  return JSON.parse(output).streams || [];
}

module.exports = { sha256File, probeMedia };
