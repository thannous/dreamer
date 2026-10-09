'use strict';

const { spawnSync } = require('node:child_process');

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

function runJestChanged({
  argv = process.argv.slice(2),
  env = process.env,
  execPath = process.execPath,
  jestBin = require.resolve('jest/bin/jest'),
  spawnSyncImpl = spawnSync,
  gitImpl = git,
} = {}) {
  const result = spawnSyncImpl(execPath, [jestBin, ...buildJestArgs(argv, env, gitImpl)], {
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

module.exports = { buildJestArgs, resolveChangedSince, runJestChanged };
