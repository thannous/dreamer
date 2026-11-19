const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { replaceFile } = require('./replace-file.cjs');

const ROOT = path.resolve(__dirname, '../..');

function parseSnapshotArgs(argv, defaults, printHelp, fields) {
  const options = { checkedAt: new Date().toISOString(), ...defaults };
  options.file = path.resolve(ROOT, options.file);
  const accepted = { '--file': 'file', '--checked-at': 'checkedAt', '--source': 'source', ...fields };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') {
      printHelp();
      process.exit(0);
    }
    if (!Object.hasOwn(accepted, flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[index + 1];
    const field = accepted[flag];
    if (typeof field === 'function') field(options, value);
    else if (field === 'input' || field === 'file') options[field] = path.resolve(ROOT, value ?? '');
    else options[field] = value;
  }
  return options;
}

function readSnapshotInput(options, source) {
  if (options.input) return fs.readFileSync(options.input, 'utf8');
  if (process.stdin.isTTY) throw new Error(`Missing --input. You can also pipe ${source} through stdin.`);
  return fs.readFileSync(0, 'utf8');
}

function parseSnapshotJson(raw, source) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source} input must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function requireSnapshotDate(value) {
  if (Number.isNaN(Date.parse(value))) throw new Error('--checked-at must be a valid date.');
}

function writeSnapshot(file, document) {
  const contents = `${JSON.stringify(document, null, 2)}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat) fs.accessSync(file, fs.constants.W_OK);

  // A pipe, hard link or dangling symlink has an identity supplied by the CLI caller.
  if (stat ? !stat.isFile() || stat.nlink > 1 : fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) {
    fs.writeFileSync(file, contents, 'utf8');
    return;
  }
  const target = stat ? fs.realpathSync(file) : file;
  const temporary = path.join(path.dirname(target), `.qa-snapshot-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode: stat?.mode ?? 0o666 });
    if (stat) fs.chmodSync(temporary, stat.mode & 0o777);
    replaceFile(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

module.exports = { parseSnapshotArgs, readSnapshotInput, parseSnapshotJson, requireSnapshotDate, writeSnapshot };
