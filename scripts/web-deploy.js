#!/usr/bin/env node
'use strict';

// Production publish of the Vercel web app (dream.noctalia.app,
// noctalia.vercel.app): `npm run web:deploy:prod`, the only production deploy
// of that project. vercel.json turns Git deployments off.
//
// Order: guard, clean copy, link, pull, build, guard again, deploy.
// 1. The publish guard (scripts/check-site-publish-proof.mjs) must accept: HEAD
//    is origin/master after `git fetch`, the checkout is clean, and a passed
//    `release` proof of `npm run verify:release` exists for HEAD. No override.
// 2. The guard proves tracked files only, so nothing runs in the working
//    directory: `git archive` of the guarded SHA is extracted into a fresh temp
//    dir (no .git, no untracked or ignored file).
// 3. In that copy, `vercel link` for the pinned project; .vercel/project.json
//    must carry the pinned projectId and orgId, else it refuses.
// 4. `vercel pull --environment=production` (project settings and the
//    production env file, kept inside the copy), then `vercel build --prod`:
//    only .vercel/output is uploaded later, which keeps the deploy under the
//    Hobby CLI upload limit (the full tree is ~341 MiB).
// 5. Right before the deploy, the guard again: it must accept the same HEAD
//    the copy was made from, and the link is checked again.
// 6. `vercel deploy --prebuilt --prod` from the copy.
// The temp dir, with the pulled env file, is removed in a finally. Every CLI
// call names the project (--scope, --project) and runs without
// VERCEL_PROJECT_ID / VERCEL_ORG_ID, so an ambient value for another project
// cannot redirect it. VERCEL_TOKEN is never in argv (the CLI reads it from the
// env). CLI output is captured and printed with the pulled env values and the
// token redacted. Same pattern as skillcodex's scripts/deploy-production.mjs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const VERCEL_SCOPE = 'thanhs-projects-9baa3976';
const VERCEL_PROJECT = 'noctalia';
// The ids of thanhs-projects-9baa3976/noctalia, as Vercel reports them for
// this repo (projectId and teamId in the Vercel bot links on dreamer PRs).
const VERCEL_PROJECT_ID = 'prj_ehKoWHHtWwekaivfEmqCCHRbjogu';
const VERCEL_ORG_ID = 'team_2wbw33JALkqNG73AvmOQO17L';
// Pinned CLI, same version as skillcodex: a production deploy must not pick
// up whatever `vercel` is latest on the day.
const VERCEL_CLI = 'vercel@62.2.0';
// Ambient variables that would select a project or team other than the flags.
const STRIPPED_ENV = ['VERCEL_PROJECT_ID', 'VERCEL_ORG_ID'];
const REDACTED = '[redacted]';
// Pulled values shorter than this (true, 1, prod) are not redacted, so the
// log stays readable; secrets are longer.
const MIN_REDACTED_LENGTH = 6;

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
    throw new Error('vercel link did not write .vercel/project.json in the clean copy; nothing was deployed.');
  }
  if (!link || link.projectId !== VERCEL_PROJECT_ID || link.orgId !== VERCEL_ORG_ID) {
    throw new Error(
      `production publish of the web app refused: the Vercel link is project ${JSON.stringify(link?.projectId)} in ${JSON.stringify(link?.orgId)}, ` +
        `not ${VERCEL_SCOPE}/${VERCEL_PROJECT} (${VERCEL_PROJECT_ID} in ${VERCEL_ORG_ID}). Nothing was uploaded.`
    );
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

// The child env: the caller's env without the project or team selectors, so
// only the explicit flags choose the project. VERCEL_TOKEN stays in the env.
function vercelEnv(env = process.env) {
  const child = { ...env };
  for (const name of STRIPPED_ENV) delete child[name];
  return child;
}

function projectArgs() {
  return ['--scope', VERCEL_SCOPE, '--project', VERCEL_PROJECT];
}

function buildVercelLinkArgs() {
  return ['--yes', VERCEL_CLI, 'link', '--yes', ...projectArgs()];
}

function buildVercelPullArgs() {
  return ['--yes', VERCEL_CLI, 'pull', '--yes', '--environment=production', ...projectArgs()];
}

function buildVercelBuildArgs() {
  return ['--yes', VERCEL_CLI, 'build', '--prod', '--yes', ...projectArgs()];
}

function buildVercelDeployArgs(commitHash) {
  if (!/^[0-9a-f]{40}$/i.test(String(commitHash || ''))) {
    throw new Error(`Vercel publish requires the guarded 40-character commit SHA (got "${commitHash}").`);
  }
  return ['--yes', VERCEL_CLI, 'deploy', '--prebuilt', '--prod', '--yes', ...projectArgs(), '--meta', `gitCommitSha=${commitHash}`];
}

// Values to hide from any printed output: every value of the env files
// `vercel pull` wrote in the copy, and VERCEL_TOKEN.
function parseEnvValues(text) {
  const values = [];
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[1].trim();
    if (/^(["']).*\1$/s.test(value)) value = value.slice(1, -1);
    if (value) values.push(value, value.replace(/\\n/g, '\n'));
  }
  return values;
}

function collectSecrets(source, env = process.env) {
  const secrets = [];
  const dir = source ? path.join(source, '.vercel') : null;
  if (dir && fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (/^\.env/.test(name)) secrets.push(...parseEnvValues(fs.readFileSync(path.join(dir, name), 'utf8')));
    }
  }
  if (env.VERCEL_TOKEN) secrets.push(String(env.VERCEL_TOKEN));
  return [...new Set(secrets.filter((value) => value.length >= MIN_REDACTED_LENGTH))].sort((a, b) => b.length - a.length);
}

function redact(text, secrets) {
  let result = String(text ?? '');
  for (const secret of secrets) result = result.split(secret).join(REDACTED);
  return result;
}

function run(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = process.env, write = (stream, text) => process[stream].write(text) } = options;
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // The env file may appear during this command (vercel pull): read it after.
  const secrets = collectSecrets(cwd === ROOT_DIR ? null : cwd, env);
  if (result.stdout) write('stdout', redact(result.stdout, secrets));
  if (result.stderr) write('stderr', redact(result.stderr, secrets));
  if (result.error) throw new Error(`Command failed to start: ${command} ${args.join(' ')} (${redact(result.error.message, secrets)})`);
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${command} ${args.join(' ')}`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/web-deploy.js prod

Publishes the Vercel web app (project ${VERCEL_SCOPE}/${VERCEL_PROJECT}) to
production. Refuses unless HEAD is the fetched origin/master, the checkout is
clean, and \`npm run verify:release\` passed on HEAD
(scripts/check-site-publish-proof.mjs). In a clean copy of that commit (git
archive in a temp dir) it links the pinned project, pulls the production
settings, builds, runs the guard again on the same HEAD, then deploys only the
prebuilt output (\`vercel deploy --prebuilt --prod\`). The CLI is pinned
(${VERCEL_CLI}). There is no override. Set VERCEL_TOKEN in the environment;
never commit it.`);
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

  const parentDir = fs.mkdtempSync(path.join(tempRoot, 'noctalia-vercel-'));
  try {
    const source = createCleanCopy(accepted.head, { rootDir, parentDir });
    const options = { cwd: source, env: vercelEnv(env) };
    runCommand('npx', buildVercelLinkArgs(), options);
    assertProjectLink(source);
    runCommand('npx', buildVercelPullArgs(), options);
    assertProjectLink(source);
    runCommand('npx', buildVercelBuildArgs(), options);
    if (!fs.existsSync(path.join(source, '.vercel', 'output', 'config.json'))) {
      throw new Error('vercel build wrote no .vercel/output/config.json in the clean copy; nothing was deployed.');
    }

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
    assertProjectLink(source);
    log(recheck.message);
    runCommand('npx', buildVercelDeployArgs(accepted.head), options);
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
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  buildVercelBuildArgs,
  buildVercelDeployArgs,
  buildVercelLinkArgs,
  buildVercelPullArgs,
  collectSecrets,
  createCleanCopy,
  main,
  parseTarget,
  redact,
  run,
  vercelEnv,
};
