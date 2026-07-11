'use strict';

const { spawnSync } = require('node:child_process');

const DEFAULT_CHANGED_SINCE = 'HEAD';

function resolveChangedSince(env = process.env) {
  const configuredBase = env.JEST_CHANGED_SINCE?.trim();
  return configuredBase || DEFAULT_CHANGED_SINCE;
}

function buildJestArgs(argv = [], env = process.env) {
  return [
    `--changedSince=${resolveChangedSince(env)}`,
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
} = {}) {
  const result = spawnSyncImpl(execPath, [jestBin, ...buildJestArgs(argv, env)], {
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

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

module.exports = {
  DEFAULT_CHANGED_SINCE,
  buildJestArgs,
  resolveChangedSince,
  runJestChanged,
};
