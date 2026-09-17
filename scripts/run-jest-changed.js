'use strict';

const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

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
  // Match .circleci/config.yml for feature branches, including stacked PRs.
  // Never silently fall back to HEAD on a clean, already committed branch.
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

function requireCleanTree(gitImpl) {
  if (gitImpl(['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error('Pre-push validation needs a clean worktree. Commit the intended changes or use an isolated worktree; do not discard unrelated work.');
  }
}

function classify(base, head) {
  const directory = mkdtempSync(path.join(tmpdir(), 'noctalia-prepush-'));
  try {
    const output = path.join(directory, 'parameters.json');
    const result = spawnSync('bash', [
      path.join(__dirname, '../.circleci/scripts/classify-changes.sh'),
      'pr', base, head, output,
    ], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('CI path classification failed.');
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runTypes(command) {
  const result = spawnSync('npm', ['run', command], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return Number.isInteger(result.status) ? result.status : 1;
}

function runPrePush({
  argv = [], env = process.env, gitImpl = git, classifyImpl = classify,
  runTypesImpl = runTypes, runJestImpl = runJestChanged, log = console.log,
} = {}) {
  if (argv.length) throw new Error('test:prepush does not accept test filters; use test:file for a focused development check.');
  requireCleanTree(gitImpl);
  const branch = gitImpl(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === 'release' || branch.startsWith('release/') || env.CIRCLE_TAG) {
    throw new Error('Release branches and tags require the complete release validation; test:prepush only qualifies affected tests for ordinary branch pushes.');
  }
  const head = gitImpl(['rev-parse', 'HEAD']);
  gitImpl(['fetch', '--no-tags', 'origin', 'master:refs/remotes/origin/master']);
  const base = resolveChangedSince({}, gitImpl);
  const parameters = classifyImpl(base, head);
  for (const key of ['run_noctalia', 'run_changed_tests', 'run_full_tests', 'run_site']) {
    if (typeof parameters[key] !== 'boolean') throw new Error(`Missing CI classification: ${key}`);
  }
  log(`Pre-push HEAD=${head} base=${base}`);
  if (parameters.run_noctalia) {
    for (const command of ['typecheck:app', 'typecheck:tests']) {
      const status = runTypesImpl(command);
      if (status !== 0) return status;
    }
  }
  const needsJest = parameters.run_changed_tests || parameters.run_full_tests || parameters.run_site;
  if (needsJest) {
    if (parameters.run_full_tests) throw new Error('No reliable affected-test selection; run the full validation prescribed by the repository guide.');
    const status = runJestImpl({
      argv: ['--runInBand', '--watchman=false'],
      env: { ...env, JEST_CHANGED_SINCE: base },
    });
    if (status !== 0) return status;
  } else {
    log('No root Jest tests selected by CI classification. Other surface-specific checks still apply.');
  }
  requireCleanTree(gitImpl);
  if (gitImpl(['rev-parse', 'HEAD']) !== head || resolveChangedSince({}, gitImpl) !== base) {
    throw new Error('HEAD or the comparison base changed during validation. Validate the final revision again.');
  }
  log(`Pre-push ${needsJest ? 'tests passed' : 'Jest not applicable'} for HEAD=${head} base=${base}. This is local evidence, not a remote CI verdict.`);
  return 0;
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    process.exitCode = argv[0] === '--pre-push'
      ? runPrePush({ argv: argv.slice(1) })
      : runJestChanged({ argv });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { buildJestArgs, resolveChangedSince, runJestChanged, runPrePush };
