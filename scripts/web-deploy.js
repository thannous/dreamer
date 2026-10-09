#!/usr/bin/env node
'use strict';

// Production publish of the Vercel web app (dream.noctalia.app,
// noctalia.vercel.app): `npm run web:deploy:prod`, the only production deploy
// of that project. vercel.json turns Git deployments off.
//
// It refuses unless the publish guard (scripts/check-site-publish-proof.mjs)
// accepts: HEAD is origin/master after `git fetch`, the checkout is clean, and
// a passed `release` proof of `npm run verify:release` exists for HEAD. Right
// before `vercel deploy --prod` it runs the guard again, which must accept the
// same HEAD (origin/master or the tree may have changed during `vercel link`).
// There is no override of any kind.

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const VERCEL_SCOPE = 'thanhs-projects-9baa3976';
const VERCEL_PROJECT = 'noctalia';

async function guardProductionPublish() {
  const { assertSitePublishProof } = await import('./check-site-publish-proof.mjs');
  return assertSitePublishProof({ root: ROOT_DIR, label: 'the Vercel web app (dream.noctalia.app)' });
}

function readHeadCommit(rootDir = ROOT_DIR) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' });
  const hash = String(result.stdout || '').trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error('Vercel publish requires a git checkout with a full 40-character HEAD SHA.');
  }
  return hash;
}

// The token never appears in a log or an error: only its presence is passed.
function tokenArgs(env = process.env) {
  const token = String(env.VERCEL_TOKEN || '').trim();
  return token ? ['--token', token] : [];
}

function buildVercelLinkArgs(env = process.env) {
  return ['--yes', 'vercel', 'link', '--yes', '--scope', VERCEL_SCOPE, '--project', VERCEL_PROJECT, ...tokenArgs(env)];
}

function buildVercelDeployArgs(commitHash, env = process.env) {
  if (!/^[0-9a-f]{40}$/i.test(String(commitHash || ''))) {
    throw new Error(`Vercel publish requires the guarded 40-character commit SHA (got "${commitHash}").`);
  }
  return [
    '--yes',
    'vercel',
    'deploy',
    '--prod',
    '--yes',
    '--scope',
    VERCEL_SCOPE,
    '--meta',
    `gitCommitSha=${commitHash}`,
    ...tokenArgs(env),
  ];
}

function describe(args) {
  const shown = [];
  for (let index = 0; index < args.length; index += 1) {
    shown.push(args[index - 1] === '--token' ? '***' : args[index]);
  }
  return shown.join(' ');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${command} ${describe(args)}`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/web-deploy.js prod

Publishes the Vercel web app (project ${VERCEL_SCOPE}/${VERCEL_PROJECT}) to
production with \`vercel deploy --prod\`. Refuses unless HEAD is the fetched
origin/master, the checkout is clean, and \`npm run verify:release\` passed on
HEAD (scripts/check-site-publish-proof.mjs); the guard runs again right before
the deploy and must accept the same HEAD. There is no override. Set
VERCEL_TOKEN in the environment; never commit it.`);
}

function parseTarget(argv = process.argv.slice(2)) {
  const target = argv[0];
  if (target === 'prod') return target;
  if (target === '-h' || target === '--help') return 'help';
  throw new Error('Expected deployment target: prod.');
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const {
    guardProduction = guardProductionPublish,
    runCommand = run,
    readHead = readHeadCommit,
    env = process.env,
    log = console.log,
  } = deps;
  const target = parseTarget(argv);
  if (target === 'help') {
    printHelp();
    return;
  }

  // Before anything else: a refused publish runs nothing.
  const accepted = await guardProduction();
  log(accepted.message);

  runCommand('npx', buildVercelLinkArgs(env));

  // Right before the irreversible deploy: fetch origin/master again and rerun
  // every check, which must accept the same HEAD.
  const recheck = await guardProduction();
  if (recheck.head !== accepted.head) {
    throw new Error(
      `production publish of the web app refused: HEAD moved from ${accepted.head} to ${recheck.head} between the guard and the deploy. There is no override.`
    );
  }
  const head = readHead();
  if (head !== accepted.head) {
    throw new Error(`production publish of the web app refused: HEAD is ${head}, not the guarded ${accepted.head}. There is no override.`);
  }
  log(recheck.message);
  runCommand('npx', buildVercelDeployArgs(accepted.head, env));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[web-deploy] Failed: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  buildVercelDeployArgs,
  buildVercelLinkArgs,
  describe,
  main,
  parseTarget,
};
