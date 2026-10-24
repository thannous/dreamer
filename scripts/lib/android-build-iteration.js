'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { replaceFile } = require('./replace-file.cjs');

const STATE_FILE = '.expo/android-build-state.json';
const LOCK_FILE = '.expo/android-build.lock';
const GENERATED = new Set(['build', '.gradle', '.cxx', '.kotlin']);
const SESSION_METADATA = new Set(['WSL_INTEROP', 'CODEX_TOOL_CALL_ID', 'SHLVL', '_', 'PWD', 'OLDPWD',
  'NPM_LIFECYCLE_EVENT', 'NPM_LIFECYCLE_SCRIPT']);

function hashFile(file) {
  try { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function buildContext(root, { env, abi, profile, profileable, sideBySideQa }) {
  const files = {};
  const collect = relative => {
    const full = path.join(root, relative);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Object.assign(new Error('Android iteration inputs must not contain symlinks.'), { code: 'ANDROID_ITERATION_INPUT_LINK' });
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) {
        const gradleOutput = relative === 'android' || /^android\/[^/]+$/.test(relative);
        if (!(gradleOutput && GENERATED.has(name))) collect(path.posix.join(relative, name));
      }
    } else if (stat.isFile()) files[relative] = hashFile(full);
  };
  collect('android');
  for (const directory of ['patches', 'plugins', 'release'])
    if (fs.existsSync(path.join(root, directory))) collect(directory);
  for (const file of ['app.json', 'app.config.ts', 'package.json', 'package-lock.json',
    'metro.config.js', 'babel.config.js', 'global.css',
    'scripts/build-android-release-local.js', 'scripts/lib/android-build-iteration.js'])
    files[file] = hashFile(path.join(root, file));
  // Keep all effective build variables, including unknown ones. Shell/session
  // labels are not inputs: WSL_INTEROP changes with every independent WSL call,
  // and npm's two lifecycle labels differ between clean and iteration commands.
  // cwd is fixed by the runner and root is hashed separately. Neither values
  // nor individual secret hashes are persisted. The bundle always reruns.
  const environment = Object.entries(env).filter(([key]) => !SESSION_METADATA.has(key.toUpperCase()))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return createHash('sha256').update(JSON.stringify({
    schemaVersion: 1, root: path.resolve(root), node: process.version, platform: process.platform,
    abi, profile, profileable, sideBySideQa, environment, files,
  })).digest('hex');
}

function contextForBuild(root, inputs, incremental) {
  try { return buildContext(root, inputs); }
  catch (error) {
    // The optional cache must not reject an existing clean Release project.
    // A null context cannot prime a subsequent (strict) iteration build.
    if (!incremental && error.code === 'ANDROID_ITERATION_INPUT_LINK') return null;
    throw error;
  }
}

function iterationPlan(root, context, incremental) {
  let previous;
  try { previous = JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8')); }
  catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error; }
  const reuse = Boolean(incremental && previous?.schemaVersion === 1
    && previous.status === 'passed' && previous.context === context);
  return { context, reuse, reason: !incremental ? 'clean qualification build'
    : reuse ? 'same native/profile/environment inputs' : 'missing, changed or unsuccessful previous build' };
}

function recordBuild(root, plan, status) {
  const target = path.join(root, STATE_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, context: plan.context, status }) + '\n', { flag: 'wx' });
    replaceFile(temporary, target);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function acquireBuildLock(root) {
  const file = path.join(root, LOCK_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const token = randomUUID();
  let fd;
  try { fd = fs.openSync(file, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Android build lock exists: ${file}. Check its owner before removing a stale lock.`);
  }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token }) + '\n');
  fs.closeSync(fd);
  return () => {
    if (JSON.parse(fs.readFileSync(file, 'utf8')).token !== token)
      throw new Error('Android build lock ownership changed; refusing to release it.');
    fs.unlinkSync(file);
  };
}

module.exports = { STATE_FILE, LOCK_FILE, buildContext, contextForBuild, iterationPlan, recordBuild, acquireBuildLock };
