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
//
// The guard proves tracked files only, so the upload never comes from the
// working directory: `git archive` of the guarded SHA is extracted into a
// fresh temp dir, `vercel link` writes .vercel/project.json there, and
// `vercel deploy --prod` runs with that dir as cwd. Untracked or ignored files
// (dist/, .env*, caches) cannot ship. The temp dir is removed in a finally,
// on success and on failure. Same pattern as skillcodex's
// scripts/deploy-production.mjs (deploy from a clean copy of the commit).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const VERCEL_SCOPE = 'thanhs-projects-9baa3976';
const VERCEL_PROJECT = 'noctalia';
// Pinned CLI, same version as skillcodex: a production deploy must not pick
// up whatever `vercel` is latest on the day.
const VERCEL_CLI = 'vercel@62.2.0';

async function guardProductionPublish() {
  const { assertSitePublishProof } = await import('./check-site-publish-proof.mjs');
  return assertSitePublishProof({ root: ROOT_DIR, label: 'the Vercel web app (dream.noctalia.app)' });
}

// A clean copy of exactly `commitHash`: the files of its tree, no .git, no
// untracked or ignored file. The repo has no .gitattributes, so no
// export-ignore or export-subst changes the archive.
function createCleanCopy(commitHash, { rootDir = ROOT_DIR, parentDir } = {}) {
  if (!/^[0-9a-f]{40}$/i.test(String(commitHash || ''))) {
    throw new Error(`Vercel publish requires the guarded 40-character commit SHA (got "${commitHash}").`);
  }
  const source = path.join(parentDir, 'source');
  const archive = path.join(parentDir, 'source.tar');
  fs.mkdirSync(source);
  const packed = spawnSync('git', ['archive', '--format=tar', '-o', archive, commitHash], { cwd: rootDir, encoding: 'utf8' });
  if (packed.status !== 0) {
    throw new Error(`git archive of ${commitHash} failed: ${String(packed.stderr || '').trim()}`);
  }
  const extracted = spawnSync('tar', ['-xf', archive, '-C', source], { encoding: 'utf8' });
  if (extracted.status !== 0) {
    throw new Error(`Extracting the archive of ${commitHash} failed: ${String(extracted.stderr || '').trim()}`);
  }
  fs.rmSync(archive, { force: true });
  return source;
}

function assertProjectLink(source) {
  const linkFile = path.join(source, '.vercel', 'project.json');
  let link;
  try {
    link = JSON.parse(fs.readFileSync(linkFile, 'utf8'));
  } catch {
    throw new Error(`vercel link did not write ${linkFile}; nothing was deployed.`);
  }
  if (!link || typeof link.projectId !== 'string' || !link.projectId || typeof link.orgId !== 'string' || !link.orgId) {
    throw new Error(`${linkFile} has no projectId or orgId; nothing was deployed.`);
  }
  return link;
}

function readHeadCommit(rootDir = ROOT_DIR) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' });
  const hash = String(result.stdout || '').trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error('Vercel publish requires a git checkout with a full 40-character HEAD SHA.');
  }
  return hash;
}

// VERCEL_TOKEN is never put in argv (visible in process listings): the CLI
// reads it from the environment the child inherits.
function buildVercelLinkArgs() {
  return ['--yes', VERCEL_CLI, 'link', '--yes', '--scope', VERCEL_SCOPE, '--project', VERCEL_PROJECT];
}

function buildVercelDeployArgs(commitHash) {
  if (!/^[0-9a-f]{40}$/i.test(String(commitHash || ''))) {
    throw new Error(`Vercel publish requires the guarded 40-character commit SHA (got "${commitHash}").`);
  }
  return [
    '--yes',
    VERCEL_CLI,
    'deploy',
    '--prod',
    '--yes',
    '--scope',
    VERCEL_SCOPE,
    '--meta',
    `gitCommitSha=${commitHash}`,
  ];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT_DIR,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${command} ${args.join(' ')}`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/web-deploy.js prod

Publishes the Vercel web app (project ${VERCEL_SCOPE}/${VERCEL_PROJECT}) to
production with \`vercel deploy --prod\`. Refuses unless HEAD is the fetched
origin/master, the checkout is clean, and \`npm run verify:release\` passed on
HEAD (scripts/check-site-publish-proof.mjs); the guard runs again right before
the deploy and must accept the same HEAD. The CLI is pinned (${VERCEL_CLI}). The upload is a clean copy of that
commit (git archive in a temp dir), never the working directory. There is no
override. Set
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
    rootDir = ROOT_DIR,
    tempRoot = os.tmpdir(),
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

  const parentDir = fs.mkdtempSync(path.join(tempRoot, 'noctalia-vercel-'));
  try {
    const source = createCleanCopy(accepted.head, { rootDir, parentDir });
    runCommand('npx', buildVercelLinkArgs(), { cwd: source });
    assertProjectLink(source);

    // Right before the irreversible deploy: fetch origin/master again and
    // rerun every check, which must accept the same HEAD the copy was made from.
    const recheck = await guardProduction();
    if (recheck.head !== accepted.head) {
      throw new Error(
        `production publish of the web app refused: HEAD moved from ${accepted.head} to ${recheck.head} between the guard and the deploy. There is no override.`
      );
    }
    const head = readHead(rootDir);
    if (head !== accepted.head) {
      throw new Error(`production publish of the web app refused: HEAD is ${head}, not the guarded ${accepted.head}. There is no override.`);
    }
    log(recheck.message);
    runCommand('npx', buildVercelDeployArgs(accepted.head), { cwd: source });
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[web-deploy] Failed: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  buildVercelDeployArgs,
  createCleanCopy,
  buildVercelLinkArgs,
  main,
  parseTarget,
};
