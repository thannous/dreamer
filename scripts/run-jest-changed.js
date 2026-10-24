'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Every new version of a file adds transform entries: an older cache starts over.
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed. Fetch origin/master before validating.\n${result.stderr || ''}`);
  }
  return result.stdout.trim();
}

function resolveChangedSince(env = process.env, gitImpl = git) {
  const configuredBase = env.JEST_CHANGED_SINCE?.trim();
  if (configuredBase) return configuredBase;
  // Match .circleci/config.yml for feature branches, including stacked PRs, and
  // the base verify:pr reports. Never silently fall back to HEAD on a clean,
  // already committed branch.
  return gitImpl(['merge-base', 'HEAD', 'origin/master']);
}

function buildJestArgs(argv = [], env = process.env, gitImpl = git) {
  return [
    `--changedSince=${resolveChangedSince(env, gitImpl)}`,
    '--passWithNoTests',
    '--silent',
    ...argv,
  ];
}

// verify:pr keeps Jest's cache in the clone's shared git directory. Its
// isolated copy sits at the same path from one run to the next, so a later run
// reuses the transforms and file map an earlier one built. A release, or a run
// outside the engine, keeps Jest's own default.
function cacheDirectory(env = process.env, now = Date.now(), fsImpl = fs) {
  if (env.VERIFY_LOCAL_KIND !== 'pr' || !env.VERIFY_LOCAL_COMMON_DIR) return null;
  const directory = path.join(env.VERIFY_LOCAL_COMMON_DIR, 'verify-cache', 'jest');
  const stamp = path.join(directory, '.created');
  let created = null;
  try {
    created = fsImpl.statSync(stamp).mtimeMs;
  } catch {}
  if (created === null || now - created > CACHE_MAX_AGE_MS) {
    fsImpl.rmSync(directory, { recursive: true, force: true });
    fsImpl.mkdirSync(directory, { recursive: true });
    fsImpl.writeFileSync(stamp, '');
  }
  return directory;
}

function runJestChanged({
  argv = process.argv.slice(2),
  env = process.env,
  execPath = process.execPath,
  jestBin = require.resolve('jest/bin/jest'),
  spawnSyncImpl = spawnSync,
  gitImpl = git,
} = {}) {
  const cache = cacheDirectory(env);
  const args = [...buildJestArgs(argv, env, gitImpl), ...(cache ? [`--cacheDirectory=${cache}`] : [])];
  const result = spawnSyncImpl(execPath, [jestBin, ...args], {
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return Number.isInteger(result.status) ? result.status : 1;
}

if (require.main === module) {
  try {
    process.exitCode = runJestChanged();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { buildJestArgs, cacheDirectory, resolveChangedSince, runJestChanged };
