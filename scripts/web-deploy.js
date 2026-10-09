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
// The temp dir (mode 0700 from mkdtemp), with the pulled env file, is removed
// in a finally and by the SIGINT/SIGTERM handlers, which also stop the running
// CLI and exit non-zero. At start, stale noctalia-vercel-* dirs left by a
// killed run are swept (see sweepStaleCopies). Every CLI call names the
// project (--scope, --project) and runs with an allowlisted env (see
// vercelEnv): no ambient EXPO_PUBLIC_*, NOCTALIA_*, NODE_ENV or
// VERCEL_PROJECT_ID / VERCEL_ORG_ID can reach `vercel build` or redirect the
// project. VERCEL_TOKEN is never in argv (the CLI reads it from the env). CLI
// output is captured and printed with the pulled env values and the token
// redacted. Same pattern as skillcodex's scripts/deploy-production.mjs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
// The only variables a Vercel call receives, when set. Anything else in the
// release shell (EXPO_PUBLIC_*, NOCTALIA_*, NODE_ENV, npm_*, VERCEL_PROJECT_ID,
// VERCEL_ORG_ID...) is dropped: `vercel build` loads the pulled production env
// without overriding variables already set, so an ambient one would win and
// be inlined in the production bundle.
//   PATH          find npx, node, git and the shell the CLI spawns.
//   HOME          npm's default cache (~/.npm) and the Vercel CLI config dir.
//   TMPDIR        where npm and the CLI write their temp files.
//   VERCEL_TOKEN  authentication; read from the env, never put in argv.
//   HTTPS_PROXY, HTTP_PROXY, NO_PROXY (and lowercase), NODE_EXTRA_CA_CERTS:
//                 only reach the registry and the Vercel API from a host that
//                 needs a proxy or a corporate CA; none is read by the app.
//   Windows only: SYSTEMROOT, COMSPEC, PATHEXT, USERPROFILE, APPDATA,
//                 LOCALAPPDATA, which node, npx and cmd.exe need to start,
//                 and TEMP, TMP, the temp dirs npm and node use there.
// Not passed: LANG/LC_* (CLI output is English either way), npm_config_*
// (the default cache under HOME is enough; an inherited registry or cache
// override is exactly what this pin avoids), NODE_OPTIONS.
const ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'TMPDIR',
  'VERCEL_TOKEN',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'https_proxy',
  'http_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
];
const WINDOWS_ENV_ALLOWLIST = ['SYSTEMROOT', 'COMSPEC', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP'];
// Temp copies live in os.tmpdir() under this prefix; the owner's pid is
// written next to the copy so a later run can tell a live run from a dead one.
const TEMP_PREFIX = 'noctalia-vercel-';
const OWNER_FILE = 'owner.pid';
// A dir without a readable owner pid is swept only once older than this.
const STALE_WITHOUT_OWNER_MS = 6 * 60 * 60 * 1000;
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };
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

// The child env, built from ENV_ALLOWLIST only (see above).
function vercelEnv(env = process.env, platform = process.platform) {
  const names = platform === 'win32' ? [...ENV_ALLOWLIST, ...WINDOWS_ENV_ALLOWLIST] : ENV_ALLOWLIST;
  const child = {};
  for (const [name, value] of Object.entries(env)) {
    const allowed = platform === 'win32' ? names.some((entry) => entry.toUpperCase() === name.toUpperCase()) : names.includes(name);
    if (allowed && value !== undefined) child[name] = value;
  }
  return child;
}

// The env of `vercel build`, which runs `npm install` (every dependency's
// lifecycle scripts) and the project build command: the allowlist without
// VERCEL_TOKEN, and HOME pointed at an empty dir inside the temp copy, so no
// third-party script can read the token, a `vercel login` auth file or an
// ~/.npmrc credential from the real HOME. npm keeps its download cache
// (package tarballs, no credentials) through npm_config_cache. The build
// needs no auth: it reads the link and the settings `vercel pull` cached in
// .vercel/ (vercel@62.2.0 lists build among SUBCOMMANDS_WITHOUT_TOKEN, and
// without --project or --scope it resolves nothing remotely).
function buildEnv(env, buildHome, platform = process.platform) {
  const child = vercelEnv(env, platform);
  const realHome = child.HOME;
  for (const name of Object.keys(child)) {
    if (name.toUpperCase() === 'VERCEL_TOKEN') delete child[name];
  }
  child.HOME = buildHome;
  if (platform === 'win32') child.USERPROFILE = buildHome;
  if (realHome) child.npm_config_cache = path.join(realHome, '.npm');
  return child;
}

// Stops a CLI step and everything it started. POSIX: the step runs in its own
// process group (spawned detached), so the group gets SIGTERM, then SIGKILL if
// it has not closed within timeoutMs. Windows has no process groups: the tree
// is ended with `taskkill /pid <pid> /T /F` (best effort, not exercised here).
async function stopProcessTree(child, { platform = process.platform, kill = process.kill, timeoutMs = 5000 } = {}) {
  if (!child || !child.pid || !child.closed) return;
  const closedWithin = (ms) =>
    Promise.race([child.closed.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), ms).unref())]);
  const signalGroup = (signal) => {
    if (platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    try {
      kill(-child.pid, signal);
    } catch {
      // The group is already gone.
    }
  };
  signalGroup('SIGTERM');
  if (await closedWithin(timeoutMs)) return;
  signalGroup('SIGKILL');
  await closedWithin(timeoutMs);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

// Removes temp copies a killed run left behind (SIGKILL, power loss), which
// may hold the pulled production env file. Only dirs named noctalia-vercel-*
// directly under tempRoot, real directories (not symlinks) owned by this
// user, are considered. One is removed when the pid in its owner.pid is not
// alive, or, without a readable owner.pid, when it is older than 6 hours. A
// dir whose owner pid is alive (a concurrent run) is left alone.
function sweepStaleCopies({ tempRoot = os.tmpdir(), now = Date.now(), alive = isPidAlive } = {}) {
  const removed = [];
  let entries = [];
  try {
    entries = fs.readdirSync(tempRoot);
  } catch {
    return removed;
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  for (const name of entries) {
    if (!name.startsWith(TEMP_PREFIX)) continue;
    const dir = path.join(tempRoot, name);
    let stat;
    try {
      stat = fs.lstatSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || (uid !== null && stat.uid !== uid)) continue;
    let pid = NaN;
    try {
      pid = Number.parseInt(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8').trim(), 10);
    } catch {
      // No owner file: fall back to the age rule.
    }
    const stale = Number.isInteger(pid) && pid > 0 ? !alive(pid) : now - stat.mtimeMs > STALE_WITHOUT_OWNER_MS;
    if (!stale) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    removed.push(dir);
  }
  return removed;
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

// No --project or --scope (they make build resolve the project through the
// API, which needs the token) and no --yes (which would pull, also with the
// token): build uses only the local link, checked against the pinned ids, and
// the settings already pulled. Missing settings fail the build.
function buildVercelBuildArgs() {
  return ['--yes', VERCEL_CLI, 'build', '--prod'];
}

function buildVercelDeployArgs(commitHash) {
  if (!/^[0-9a-f]{40}$/i.test(String(commitHash || ''))) {
    throw new Error(`Vercel publish requires the guarded 40-character commit SHA (got "${commitHash}").`);
  }
  return ['--yes', VERCEL_CLI, 'deploy', '--prebuilt', '--prod', '--yes', ...projectArgs(), '--meta', `gitCommitSha=${commitHash}`];
}

// Values to hide from any printed output: every value of the env files
// `vercel pull` wrote in the copy, and VERCEL_TOKEN. The file is parsed the
// way `vercel build` loads it (dotenv): CRLF or CR line endings, `export`,
// single, double or backtick quotes, inline comments, and in double quotes the
// escapes \n and \r, which Vercel writes for newlines and carriage returns.
const DOTENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

function parseEnvFile(text) {
  const parsed = {};
  const lines = String(text).replace(/\r\n?/g, '\n');
  let match;
  DOTENV_LINE.lastIndex = 0;
  while ((match = DOTENV_LINE.exec(lines)) !== null) {
    let value = (match[2] || '').trim();
    const quote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/m, '$2');
    if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    parsed[match[1]] = value;
  }
  return parsed;
}

// Every spelling of a value that can reach the log: the decoded value, the
// serialized one (literal \n, \r), the value with CRLF folded to LF (as a
// terminal or a log line splitter may print it), and each line of a
// multi-line value (a certificate printed line by line).
function secretForms(value) {
  const forms = new Set([value]);
  forms.add(value.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
  forms.add(value.replace(/\r\n?/g, '\n'));
  for (const line of value.split(/\r\n|\r|\n/)) forms.add(line.trim());
  return [...forms];
}

function parseEnvValues(text) {
  return Object.values(parseEnvFile(text)).filter(Boolean).flatMap(secretForms);
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

// Runs a CLI step without blocking the event loop, so the signal handlers can
// run while it works. Output is captured and printed redacted once it ends.
function run(command, args, options = {}) {
  const { cwd = ROOT_DIR, env = process.env, write = (stream, text) => process[stream].write(text), onChild = () => {} } = options;
  return new Promise((resolve, reject) => {
    let child;
    try {
      // Detached on POSIX: its own process group, so a signal can stop the
      // CLI and every process it started (see stopProcessTree).
      child = spawn(command, args, {
        cwd,
        env,
        detached: process.platform !== 'win32',
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(new Error(`Command failed to start: ${command} ${args.join(' ')} (${error.message})`));
      return;
    }
    child.closed = new Promise((resolveClosed) => child.once('close', resolveClosed));
    onChild(child);
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      onChild(null);
      const secrets = collectSecrets(cwd === ROOT_DIR ? null : cwd, env);
      reject(new Error(`Command failed to start: ${command} ${args.join(' ')} (${redact(error.message, secrets)})`));
    });
    child.on('close', (code, signal) => {
      onChild(null);
      // The env file may appear during this command (vercel pull): read it after.
      const secrets = collectSecrets(cwd === ROOT_DIR ? null : cwd, env);
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (out) write('stdout', redact(out, secrets));
      if (err) write('stderr', redact(err, secrets));
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${signal || code}): ${command} ${args.join(' ')}`));
    });
  });
}

function printHelp() {
  console.log(`Usage: node scripts/web-deploy.js prod

Publishes the Vercel web app (project ${VERCEL_SCOPE}/${VERCEL_PROJECT}) to
production. Refuses unless HEAD is the fetched origin/master, the checkout is
clean, and \`npm run verify:release\` passed on HEAD
(scripts/check-site-publish-proof.mjs). In a clean copy of that commit (git
archive in a temp dir) it links the pinned project, pulls the production
settings, builds, runs the guard again on the same HEAD, then deploys only the
prebuilt output (\`vercel deploy --prebuilt --prod\`). Vercel calls get an
allowlisted env only (PATH, HOME, TMPDIR, VERCEL_TOKEN, proxy and CA
variables). The temp copy is removed on exit, on failure and on SIGINT or
SIGTERM (after stopping the running step's whole process group); stale
copies of killed runs are swept at start. \`vercel build\` gets no token. The CLI is pinned
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
    proc = process,
    sweep = sweepStaleCopies,
    stopTree = stopProcessTree,
    killTimeoutMs = 5000,
  } = deps;
  const target = parseTarget(argv);
  if (target === 'help') {
    printHelp();
    return;
  }

  for (const dir of sweep({ tempRoot })) log(`[web-deploy] removed a stale temp copy: ${dir}`);

  // Before anything else: a refused publish runs nothing.
  const accepted = await guardProduction();
  log(accepted.message);

  const parentDir = fs.mkdtempSync(path.join(tempRoot, TEMP_PREFIX));
  fs.writeFileSync(path.join(parentDir, OWNER_FILE), `${proc.pid ?? process.pid}\n`);
  let child = null;
  let stopping = null;
  // On SIGINT or SIGTERM: stop the running CLI step and its whole process
  // tree, wait for it, then remove the copy and exit 130 or 143. The main flow
  // waits for this before its own cleanup, so the exit code is the signal's.
  const onSignal = (signal) => {
    if (stopping) return;
    stopping = (async () => {
      await stopTree(child, { timeoutMs: killTimeoutMs });
      fs.rmSync(parentDir, { recursive: true, force: true });
      console.error(`[web-deploy] ${signal}: the running Vercel step and its processes were stopped, temp copy removed.`);
      proc.exit(SIGNAL_EXIT_CODES[signal] || 1);
    })();
  };
  const handlers = Object.keys(SIGNAL_EXIT_CODES).map((signal) => [signal, () => onSignal(signal)]);
  for (const [signal, handler] of handlers) proc.on(signal, handler);
  try {
    const source = createCleanCopy(accepted.head, { rootDir, parentDir });
    const onChild = (running) => (child = running);
    const options = { cwd: source, env: vercelEnv(env), onChild };
    const buildHome = path.join(parentDir, 'build-home');
    fs.mkdirSync(buildHome);
    const buildOptions = { cwd: source, env: buildEnv(env, buildHome), onChild };
    await runCommand('npx', buildVercelLinkArgs(), options);
    assertProjectLink(source);
    await runCommand('npx', buildVercelPullArgs(), options);
    assertProjectLink(source);
    await runCommand('npx', buildVercelBuildArgs(), buildOptions);
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
    await runCommand('npx', buildVercelDeployArgs(accepted.head), options);
  } finally {
    // A signal stops the step, which makes it fail: let the handler finish
    // (it exits with the signal's code) before the ordinary cleanup.
    try {
      if (stopping) await stopping;
    } finally {
      for (const [signal, handler] of handlers) proc.removeListener(signal, handler);
      fs.rmSync(parentDir, { recursive: true, force: true });
    }
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
  buildEnv,
  buildVercelBuildArgs,
  buildVercelDeployArgs,
  buildVercelLinkArgs,
  buildVercelPullArgs,
  collectSecrets,
  createCleanCopy,
  parseEnvFile,
  main,
  parseTarget,
  redact,
  run,
  stopProcessTree,
  sweepStaleCopies,
  vercelEnv,
};
