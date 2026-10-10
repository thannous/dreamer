#!/usr/bin/env node
// Local verification engine of the common delivery rule (regle-commune-livraison v4).
// The rule is this repository's own copy of the common text, at the path its
// AGENTS.md links to (and its section 13.1 names).
//
// The same engine file in every repository is recommended. Each repository
// keeps its own copy, pins and verifies only that copy (ENGINE_SHA256 in its
// verify-local.config.mjs), and describes its checks in verify-local.config.mjs
// at its root. Nothing here reads or compares another repository.
//
//   node scripts/verify-local.mjs pr       [--rev <rev>] [--force] [--keep] [--external <check>=<evidence>]
//   node scripts/verify-local.mjs release  [--rev <rev>] [--target <name>]... [--force] [--keep] [--external ...]
//   node scripts/verify-local.mjs status   [--rev <rev>] [--json]
//   node scripts/verify-local.mjs proof-block [--rev <rev>]
//   node scripts/verify-local.mjs hook <remote> [<url>]       (pre-push hook; refs on stdin)
//
// pr / release check the commit <rev> (default HEAD) in an isolated git
// worktree, so work in progress is never checked nor disturbed. The proof is
// keyed by the verified git tree and written to
// $(git rev-parse --git-common-dir)/verify-proofs/<tree>.json, shared by every
// worktree of the clone and never committed. Each check has a fingerprint (its
// command, its input files, Node and the package manager): for verify:pr, a
// check whose fingerprint already passed in any proof is reused instead of run
// again, so a merge of a base that did not touch a check's inputs replays
// nothing for it. verify:release reuses nothing: every release check runs on
// the delivered commit, so a publication never rests on an earlier run.
//
// deps.mode 'link' links the main checkout's node_modules when the lockfile
// is the same (workspace links point at the copy); a check with install: true
// (a bundler that refuses links) gets a real deps.install first.
//
// Checks run in the isolated copy with VERIFY_LOCAL_KIND, VERIFY_LOCAL_SHA,
// VERIFY_LOCAL_TREE, VERIFY_LOCAL_ROOT (the main checkout) and
// VERIFY_LOCAL_COMMON_DIR (the shared git directory, for caches) set, with
// TMPDIR in a directory of their own removed with the copy, and without the
// GIT_* variables of a hook nor the variables that narrow what a check runs
// (SCOPE_ENV, plus the config's stripEnv). In a PR, a `when` check runs only
// if its paths changed since origin/<main> (a docs-only PR skips typecheck in a
// fresh clone). A release runs every check, `when` ones included: on the main
// commit nothing changed since origin/<main>, and a release proves the
// delivered commit, not a diff (releaseAlways is implied).
//
// --external <check>=<evidence> stands in only for a specialised check whose
// probe fails here. The evidence is "owner-machine: <host> <note> on <SHA>"
// (a run on the owner's machine), or cites a run whose https:// URL starts
// with one of the config's externalSources (the External CI table, section 13
// of the repository's own delivery rule); any other https:// URL,
// and any http:// URL, is refused. It names the full verified head SHA exactly
// once and no other full SHA, so a squash needs its own evidence. It is stored
// verbatim, listed by name, never reused, and checked again by the deploy
// guard against the same config.
//
// Installs, setup and checks take the machine-wide lock HEAVY_LOCK (flock),
// so verify runs on one machine wait for each other ("waiting for lock").
// A step killed by a signal counts as failed.
//
// Exit codes: 0 passed, 1 failed, 2 incomplete (a required specialised check
// could not run here; see --external), 64 usage or configuration error.

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RULE = 'regle-commune-livraison v4';
// 3: --external is guarded (specialised, probe fails, evidence names the
// commit or tree) and never reused; proofs written before that are ignored.
export const PROOF_FORMAT_VERSION = 3;
export const ENGINE_VERSION = 1;
export const CONFIG_FILE = 'verify-local.config.mjs';
export const PROOFS_DIR = 'verify-proofs';
const PREFIX = '[verify-local]';
const MAX_PROOF_FILES = 300;

// Variables that pin git to one repository; a check that creates its own
// repositories (hook tests) or runs in another worktree must not inherit them.
const GIT_ENV_KEYS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
  'GIT_QUARANTINE_PATH',
];

export function cleanGitEnv(env = process.env) {
  const result = { ...env };
  for (const key of GIT_ENV_KEYS) delete result[key];
  return result;
}

class UsageError extends Error {}

// ---------------------------------------------------------------- git

export function createGit(cwd, env = cleanGitEnv()) {
  const run = (args, { input, allowFailure = false, maxBuffer = 256 * 1024 * 1024 } = {}) => {
    const result = spawnSync('git', args, { cwd, env, input, encoding: 'utf8', maxBuffer });
    const ok = !result.error && result.status === 0;
    if (!ok && !allowFailure) {
      const detail = result.error ? result.error.message : (result.stderr || '').trim();
      throw new Error(`git ${args.join(' ')} failed: ${detail}`);
    }
    return ok ? result.stdout.replace(/\n+$/, '') : null;
  };
  return run;
}

function resolveRepository(cwd, env) {
  const git = createGit(cwd, env);
  const root = git(['rev-parse', '--show-toplevel']);
  const rootGit = createGit(root, env);
  const commonDir = path.resolve(root, rootGit(['rev-parse', '--git-common-dir']));
  return { root, commonDir, git: rootGit };
}

// ---------------------------------------------------------------- config

/** Load verify-local.config.mjs as committed at <rev>, so the checks match the commit. */
export async function loadConfig(git, rev, { scratchDir } = {}) {
  const source = git(['show', `${rev}:${CONFIG_FILE}`], { allowFailure: true });
  if (source === null) {
    throw new UsageError(`${CONFIG_FILE} is missing at ${rev}.`);
  }
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 16);
  const dir = scratchDir ?? path.join(git(['rev-parse', '--path-format=absolute', '--git-common-dir']), 'verify-local');
  const file = path.join(dir, `config-${digest}.mjs`);
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, source);
  }
  const loaded = (await import(pathToFileURL(file).href)).default;
  return normaliseConfig(loaded);
}

export function normaliseConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new UsageError(`${CONFIG_FILE} must export a default object.`);
  const checks = (raw.checks ?? []).map((check) => {
    if (!check.name || !check.command) throw new UsageError('every check needs a name and a command.');
    const kinds = check.kinds ?? ['pr', 'release'];
    for (const kind of kinds) {
      if (kind !== 'pr' && kind !== 'release') throw new UsageError(`check ${check.name}: unknown kind ${kind}.`);
    }
    return {
      name: check.name,
      command: check.command,
      kinds,
      inputs: check.inputs ?? null,
      exclude: check.exclude ?? [],
      when: check.when ?? null,
      releaseAlways: Boolean(check.releaseAlways),
      targets: check.targets ?? null,
      perCommit: Boolean(check.perCommit),
      perBase: Boolean(check.perBase),
      specialised: Boolean(check.specialised),
      requires: check.requires ?? null,
      install: Boolean(check.install),
      env: check.env ?? {},
    };
  });
  // https:// URL prefixes of the external CI runs --external may cite, one per
  // workflow of the External CI table (none by default: owner-machine only).
  const externalSources = raw.externalSources ?? [];
  if (!Array.isArray(externalSources)) throw new UsageError('externalSources must be a list of https:// URL prefixes.');
  for (const prefix of externalSources) {
    if (typeof prefix !== 'string' || !/^https:\/\/[^\s/]+\/\S*\/$/.test(prefix) || externalUrlIssue(prefix)) {
      throw new UsageError(`externalSources: ${JSON.stringify(prefix)} must be an https:// URL prefix with a path ending in "/" (for example https://github.com/<owner>/<repo>/actions/runs/).`);
    }
  }
  const names = new Set();
  for (const check of checks) {
    if (names.has(check.name)) throw new UsageError(`check ${check.name} is declared twice.`);
    names.add(check.name);
    // A release proof must also prove what a PR proof proves.
    if (check.kinds.includes('pr') && !check.kinds.includes('release')) {
      throw new UsageError(`check ${check.name} runs for pr but not for release; release must include every pr check.`);
    }
  }
  return {
    mainBranch: raw.mainBranch ?? 'main',
    commands: { pr: raw.commands?.pr ?? 'verify:pr', release: raw.commands?.release ?? 'verify:release' },
    deps: {
      mode: raw.deps?.mode ?? 'link',
      lockfile: raw.deps?.lockfile ?? null,
      install: raw.deps?.install ?? null,
      copy: raw.deps?.copy ?? [],
    },
    setup: raw.setup ?? [],
    // The repository's own check scripts (hook installer, lint wrappers…):
    // changing them changes what the checks prove, like the config itself.
    deliveryFiles: raw.deliveryFiles ?? [],
    // Repository variables that narrow what a check runs, stripped like SCOPE_ENV.
    stripEnv: raw.stripEnv ?? [],
    externalSources,
    checks,
    hook: {
      forbidden: raw.hook?.forbidden ?? DEFAULT_FORBIDDEN,
      allow: raw.hook?.allow ?? [],
      secretAllow: raw.hook?.secretAllow ?? [],
      maxFileBytes: raw.hook?.maxFileBytes ?? 10 * 1024 * 1024,
      checks: raw.hook?.checks ?? [],
    },
  };
}

// ---------------------------------------------------------------- globs

/** Glob to RegExp: `**` crosses directories, `*` and `?` do not, a trailing `/` matches a prefix. */
export function globToRegExp(glob) {
  let pattern = glob.endsWith('/') ? `${glob}**` : glob;
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        const slash = pattern[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(file, globs) {
  return globs.some((glob) => globToRegExp(glob).test(file));
}

// ---------------------------------------------------------------- proofs

export function proofsDir(commonDir) {
  return path.join(commonDir, PROOFS_DIR);
}

export function readProof(commonDir, tree, name = `${tree}.json`) {
  const file = path.join(proofsDir(commonDir), name);
  if (!existsSync(file)) return null;
  try {
    const proof = JSON.parse(readFileSync(file, 'utf8'));
    return proof && proof.version === PROOF_FORMAT_VERSION ? proof : null;
  } catch {
    return null;
  }
}

/**
 * The proof to show for commit <sha> of <tree>: the tree's proof when it was
 * written for <sha>, else a run for <sha> recorded beside it (a PR run kept
 * beside a passed release proof of another commit with the same tree, which
 * stays the tree's proof for a deploy), a passed one first. Without either,
 * the tree's proof as it is, whose SHA then differs from <sha>.
 */
export function readProofFor(commonDir, tree, sha) {
  const proof = readProof(commonDir, tree);
  if (proof?.sha === sha) return proof;
  const beside = ['pr', 'release']
    .map((kind) => readProof(commonDir, tree, attemptName(tree, kind, sha)))
    .filter((attempt) => attempt?.sha === sha && attempt.tree === tree)
    .sort((a, b) => Number(b.result === 'passed') - Number(a.result === 'passed'));
  return beside[0] ?? proof;
}

/** The file of a run kept beside the tree's proof: one per commit and kind. */
export function attemptName(tree, kind, sha) {
  return `${tree}.${kind}-attempt.${sha}.json`;
}

/** The run log of commit <sha>: one JSON line per verify run, appended. */
export function runLogName(sha) {
  return `${sha}.runs.jsonl`;
}

/**
 * The entries of the run log of <sha>, oldest first. A line that cannot be
 * read (torn by a crash, corrupt, or not an entry of <sha>) becomes an
 * `unreadable` entry: it counts as a failure of every check (openChecks).
 */
export function readRunLog(commonDir, sha) {
  const file = path.join(proofsDir(commonDir), runLogName(sha));
  if (!existsSync(file)) return [];
  const entries = [];
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let entry = null;
    try {
      entry = JSON.parse(line);
    } catch {
      entry = null;
    }
    const valid = entry && typeof entry === 'object' && entry.sha === sha && typeof entry.kind === 'string'
      && typeof entry.result === 'string' && Array.isArray(entry.checks)
      && entry.checks.every((check) => check && typeof check.name === 'string' && typeof check.result === 'string');
    entries.push(valid ? entry : { kind: 'unreadable', sha, result: 'unreadable', line: index + 1, finishedAt: null, checks: [] });
  });
  return entries;
}

/** Whether a check result really ran here or came with external evidence (not reused, not out of scope). */
function realResult(check) {
  return check.result !== 'skipped' && !check.reused;
}

/**
 * The open checks of a commit: those whose latest real result in its run
 * log did not pass (failed, killed or unavailable), each with that run. A
 * reused pass, a skip or an out-of-scope check never closes one; only a run
 * that really reruns it and passes. An unreadable line may have held a
 * failure of any check, so it opens every known check (each entry lists the
 * config's checks in `known`; <known> adds the caller's), each until its own
 * real pass. With no known check at all, it stays open as `run-log`.
 */
export function openChecks(log, known = []) {
  const names = new Set(known);
  for (const entry of log) {
    for (const name of Array.isArray(entry.known) ? entry.known : []) if (typeof name === 'string') names.add(name);
    for (const check of entry.checks) names.add(check.name);
  }
  const last = new Map();
  for (const entry of log) {
    if (entry.kind === 'unreadable') {
      const item = { kind: 'unreadable', result: 'unreadable', line: entry.line, finishedAt: null };
      if (!names.size) last.set(RUN_LOG_UNREADABLE, { check: RUN_LOG_UNREADABLE, ...item });
      for (const name of names) last.set(name, { check: name, ...item });
      continue;
    }
    for (const check of entry.checks) {
      if (realResult(check)) last.set(check.name, { check: check.name, result: check.result, kind: entry.kind, finishedAt: entry.finishedAt });
    }
  }
  return [...last.values()].filter((item) => item.result !== 'passed');
}

/** The open item of an unreadable run log line when no check is known yet. */
export const RUN_LOG_UNREADABLE = 'run-log';

/** "lint (pr failed at <time>), ..." */
function describeOpen(open) {
  return open.map((item) => (item.kind === 'unreadable'
    ? `${item.check} (unreadable run log line ${item.line}, counts as failed)`
    : `${item.check} (${item.kind} ${item.result} at ${item.finishedAt})`)).join(', ');
}

/** The open-check note for status and the hook, or "". */
function openSuffix(commonDir, sha) {
  const open = openChecks(readRunLog(commonDir, sha));
  return open.length ? `; open on this commit: ${describeOpen(open)}` : '';
}

/** The proof lock is taken over after this age; a run waits longer than that. */
export const PROOF_LOCK_STALE_MS = 60000;
export const PROOF_LOCK_WAIT_MS = 90000;

/**
 * Moves a stale proof lock aside (rename is atomic: only one waiter gets a
 * given lock), so the caller can create a new one. If the lock moved aside is
 * not the one judged stale (a new owner took the name meanwhile), it is put
 * back with link, which never replaces a lock that exists.
 */
function takeOverStale(lock, staleMs) {
  let seen;
  try {
    if (Date.now() - statSync(lock).mtimeMs <= staleMs) return;
    seen = readFileSync(lock, 'utf8');
  } catch {
    return;
  }
  const aside = `${lock}.stale.${process.pid}.${randomBytes(4).toString('hex')}`;
  try {
    renameSync(lock, aside);
  } catch {
    return;
  }
  let taken = null;
  try {
    taken = readFileSync(aside, 'utf8');
  } catch {
    taken = null;
  }
  if (taken !== seen) {
    try {
      linkSync(aside, lock);
    } catch {
      // A new lock exists already; the one moved aside was not stale.
    }
  }
  rmSync(aside, { force: true });
}

/**
 * Runs <fn> holding the short proof lock: a file created exclusively, holding
 * this run's token, so concurrent runs re-read and write the proof state one
 * at a time (no flock needed). A lock older than staleMs is a dead run's and
 * is taken over. Returns { locked: true, value } or, after waitMs (longer than
 * staleMs), { locked: false }.
 */
export function withProofLock(commonDir, fn, { waitMs = PROOF_LOCK_WAIT_MS, staleMs = PROOF_LOCK_STALE_MS } = {}) {
  const dir = proofsDir(commonDir);
  mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.proof.lock');
  const token = `${process.pid}.${randomBytes(8).toString('hex')}`;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      writeFileSync(lock, token, { flag: 'wx' });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    takeOverStale(lock, staleMs);
    if (Date.now() >= deadline) return { locked: false };
    Atomics.wait(pause, 0, 0, 10);
  }
  try {
    return { locked: true, value: fn() };
  } finally {
    try {
      if (readFileSync(lock, 'utf8') === token) rmSync(lock, { force: true });
    } catch {
      // Already gone.
    }
  }
}

/** Appends one entry to the run log of <sha>, on a line of its own. */
function appendRun(commonDir, sha, entry) {
  const file = path.join(proofsDir(commonDir), runLogName(sha));
  let start = '';
  if (existsSync(file)) {
    // A torn last line (a crash mid-append) must not swallow this entry.
    const size = statSync(file).size;
    if (size > 0) {
      const fd = openSync(file, 'r');
      const last = Buffer.alloc(1);
      try {
        readSync(fd, last, 0, 1, size - 1);
      } finally {
        closeSync(fd);
      }
      if (last.toString() !== '\n') start = '\n';
    }
  }
  appendFileSync(file, `${start}${JSON.stringify(entry)}\n`);
}

/** The format version of the proof file of a tree, whatever it is, or null. */
function proofFileVersion(commonDir, tree) {
  const file = path.join(proofsDir(commonDir), `${tree}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'))?.version ?? 'unknown';
  } catch {
    return 'unreadable';
  }
}

function listProofs(commonDir) {
  const dir = proofsDir(commonDir);
  if (!existsSync(dir)) return [];
  const proofs = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const proof = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
      if (proof && proof.version === PROOF_FORMAT_VERSION) proofs.push(proof);
    } catch {
      // A torn or foreign file is ignored, never trusted.
    }
  }
  return proofs;
}

export function writeProof(commonDir, proof, name = `${proof.tree}.json`) {
  const dir = proofsDir(commonDir);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(proof, null, 2)}\n`);
  renameSync(temporary, file);
  pruneProofs(dir);
  return file;
}

function pruneProofs(dir) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json') || name.endsWith('.runs.jsonl'))
    .map((name) => ({ name, mtime: statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { name } of files.slice(MAX_PROOF_FILES)) rmSync(path.join(dir, name), { force: true });
}

/** A passed result for this fingerprint in any proof of the clone. */
function findReusable(proofs, fingerprint) {
  for (const proof of proofs) {
    for (const check of proof.checks ?? []) {
      // External evidence names one commit: it is never carried to another proof.
      if (check.fingerprint !== fingerprint || check.result !== 'passed' || check.external) continue;
      return { sha: check.reusedFrom?.sha ?? proof.sha, tree: check.reusedFrom?.tree ?? proof.tree, finishedAt: proof.finishedAt };
    }
  }
  return null;
}

// ---------------------------------------------------------------- fingerprints

function packageManagerOf(git, rev, config, env) {
  const manifest = git(['show', `${rev}:package.json`], { allowFailure: true });
  let field = null;
  try {
    field = manifest ? JSON.parse(manifest).packageManager ?? null : null;
  } catch {
    field = null;
  }
  if (field) return field;
  // No pinned version: record the one installed.
  const name = config.deps.lockfile === 'pnpm-lock.yaml' ? 'pnpm' : config.deps.lockfile === 'yarn.lock' ? 'yarn' : 'npm';
  const result = spawnSync(name, ['--version'], { env, encoding: 'utf8' });
  return !result.error && result.status === 0 ? `${name}@${result.stdout.trim()}` : null;
}

function lockfileBlob(git, rev, config) {
  if (!config.deps.lockfile) return null;
  return git(['rev-parse', `${rev}:${config.deps.lockfile}`], { allowFailure: true });
}

export function checkFingerprint({ check, files, tree, sha, environment, mergeBase = null }) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ engine: ENGINE_VERSION, name: check.name, command: check.command, env: check.env, environment }));
  if (check.perCommit) hash.update(`\ncommit ${sha}`);
  // A check that picks its work from the diff against the base (affected
  // packages, changed files) is reused only against the same merge base.
  if (check.perBase) hash.update(`\nbase ${mergeBase ?? 'none'}`);
  if (!check.inputs && check.exclude.length === 0) {
    hash.update(`\ntree ${tree}`);
  } else {
    const include = check.inputs ?? ['**'];
    for (const entry of files) {
      if (matchesAny(entry.path, include) && !matchesAny(entry.path, check.exclude)) {
        hash.update(`\n${entry.mode} ${entry.object} ${entry.path}`);
      }
    }
  }
  return hash.digest('hex');
}

function listTreeFiles(git, sha) {
  const output = git(['ls-tree', '-r', '--full-tree', '-z', sha]);
  return output
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      const [mode, , object] = line.slice(0, tab).split(' ');
      return { mode, object, path: line.slice(tab + 1) };
    });
}

// ---------------------------------------------------------------- base and scope

function resolveBase(git, config) {
  const ref = `origin/${config.mainBranch}`;
  const sha = git(['rev-parse', '--verify', '--quiet', `refs/remotes/${ref}^{commit}`], { allowFailure: true });
  return sha ? { ref, sha } : { ref, sha: null };
}

function changedFiles(git, base, sha) {
  if (!base.sha) return null;
  const mergeBase = git(['merge-base', base.sha, sha], { allowFailure: true });
  if (!mergeBase) return null;
  const output = git(['diff', '--name-only', '-z', '--no-renames', mergeBase, sha]);
  return { mergeBase, files: output.split('\0').filter(Boolean) };
}

// ---------------------------------------------------------------- isolated worktree

// Heavy steps (installs, builds, test suites) of every verify run on a machine
// take one machine-wide lock, so parallel runs wait instead of thrashing it.
// VERIFY_LOCAL_HEAVY_LOCK moves the lock file (tests); a step already under
// the lock (the engine's own tests) runs its nested steps without retaking it.
export const HEAVY_LOCK = '/tmp/fleet-verify-heavy.lock';
const HEAVY_LOCK_HELD = 'VERIFY_LOCAL_HEAVY_LOCK_HELD';
const probes = new Map();

/** Whether `program args` runs and exits 0 here, cached per PATH. */
function probeCommand(program, args, env) {
  const key = `${program}\0${env.PATH ?? ''}`;
  if (!probes.has(key)) {
    const probe = spawnSync(program, args, { env, stdio: 'ignore' });
    probes.set(key, !probe.error && probe.status === 0);
  }
  return probes.get(key);
}

/** Whether the util-linux `flock` command exists here (macOS has none by default). */
export function hasFlock(env = process.env) {
  return probeCommand('flock', ['--version'], env);
}

/** Whether `setpriv --pdeathsig` works here (Linux util-linux only). */
export function hasPdeathsig(env = process.env) {
  return probeCommand('setpriv', ['--pdeathsig', 'KILL', 'true'], env);
}

/**
 * Supervisor of one step (run by node, argv[1] = JSON [graceMs, lock,
 * program, ...args], lock null for none). With a lock, it first starts a
 * holder, `flock -o <lock>` around a shell that waits for the supervisor's
 * pipe to close, in a process group of its own: the step's processes never
 * get the lock's file descriptor, no signal sent to the step group or to the
 * terminal reaches the holder, and the supervisor frees the lock only after
 * the step group is stopped (it kills the holder, and its pipe closes if the
 * supervisor itself dies). Then it starts the step as the leader of its own
 * process group and
 * holds fd 3, a pipe whose other end only this engine holds. The kernel
 * closes that end when the engine exits, however it dies (SIGKILL, OOM), and
 * the supervisor then stops the whole group: SIGTERM, so the step's traps and
 * teardown run (including the stop of a server it started in another
 * session), then SIGKILL to whatever is left once the group is empty or after
 * graceMs. When the step's leader exits, the supervisor stops what it left in
 * the group the same way, then exits with the step's status (128 + n for a
 * signal). INT and TERM are passed on to the group, and HUP and QUIT as TERM. A process that left
 * the group (setsid) is stopped only by the step's own teardown.
 */
const STEP_SUPERVISOR = `
const { spawn } = require('node:child_process');
const net = require('node:net');
const { constants } = require('node:os');
const [grace, lock, program, ...args] = JSON.parse(process.argv[1]);
let group = null;
let holder = null;
// Frees the lock (if held), then exits.
const leave = (status) => {
  if (!holder || holder.exitCode !== null || holder.signalCode !== null) process.exit(status);
  holder.on('exit', () => process.exit(status));
  try { process.kill(-holder.pid, 'SIGKILL'); } catch { process.exit(status); }
};
let forwarded = false;
let stopping = null;
const signalGroup = (signal) => { if (!group) return false; try { process.kill(-group, signal); return true; } catch { return false; } };
const groupAlive = () => signalGroup(0);
// TERM first, so traps and teardown run (a step may stop a server it started
// in another session), then KILL whatever is left once the group is empty or
// the grace period is over.
const stop = (term, done) => {
  if (stopping) return;
  stopping = done;
  if (term) signalGroup('SIGTERM');
  const deadline = Date.now() + grace;
  const poll = () => {
    if (!groupAlive() || Date.now() >= deadline) { signalGroup('SIGKILL'); stopping(); return; }
    setTimeout(poll, 50);
  };
  poll();
};
const lifeline = new net.Socket({ fd: 3, readable: true, writable: false });
lifeline.on('data', () => {});
const orphaned = () => stop(!forwarded, () => leave(137));
lifeline.on('end', orphaned);
lifeline.on('error', orphaned);
// HUP (a closed terminal) and QUIT (Ctrl-\\) go on as TERM, the signal step
// teardowns handle; the supervisor itself stays until the group is stopped.
// A signal before the step started (still waiting for the lock) ends the run.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']) {
  process.on(signal, () => {
    forwarded = true;
    if (!group) { stopping = () => {}; leave(128 + constants.signals[signal]); return; }
    signalGroup(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
  });
}
const start = () => {
  if (stopping) return;
  const child = spawn(program, args, { stdio: 'inherit', detached: true });
  group = child.pid;
  child.on('error', (error) => { process.stderr.write(String(error.message) + '\\n'); leave(127); });
  child.on('exit', (code, signal) => {
    const status = signal ? 128 + (constants.signals[signal] ?? 1) : (code ?? 1);
    stop(true, () => leave(status));
  });
};
if (lock === null) start();
else {
  holder = spawn('flock', ['-o', lock, '/bin/sh', '-c', 'echo locked; exec cat >/dev/null'], { stdio: ['pipe', 'pipe', 'inherit'], detached: true });
  holder.on('error', (error) => { process.stderr.write(String(error.message) + '\\n'); process.exit(127); });
  let said = '';
  holder.stdout.on('data', (data) => { said += data; if (said.includes('locked\\n') && !group) start(); });
  holder.on('exit', (code, signal) => {
    // The holder ended before the step started: the lock could not be taken.
    if (!group && !stopping) { process.stderr.write('could not take the lock ' + lock + '\\n'); process.exit(1); }
  });
}
`;

/**
 * Milliseconds a step's group gets between SIGTERM and SIGKILL:
 * VERIFY_LOCAL_STEP_GRACE_MS, clamped to 1 s to 30 s, else 5 s. The floor
 * keeps a step's teardown (a server in another session) from being skipped.
 */
export const STEP_GRACE_MS = 5000;

export function stepGrace(env) {
  const raw = env.VERIFY_LOCAL_STEP_GRACE_MS;
  const value = raw === undefined || String(raw).trim() === '' ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.max(value, 1000), 30000) : STEP_GRACE_MS;
}

/** Runs [program, ...args] as a supervised process group tied to this engine. */
function supervised(lock, program, args, { cwd, env }) {
  return spawnSync(process.execPath, ['-e', STEP_SUPERVISOR, JSON.stringify([stepGrace(env), lock, program, ...args])], {
    cwd,
    env,
    stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
  });
}

function runShell(command, { cwd, env, log }) {
  log(`${PREFIX} $ ${command}`);
  const lock = env.VERIFY_LOCAL_HEAVY_LOCK || HEAVY_LOCK;
  const started = Date.now();
  let result;
  if (env[HEAVY_LOCK_HELD] === lock) {
    result = spawnSync('/bin/sh', ['-c', command], { cwd, env, stdio: 'inherit' });
  } else if (!hasFlock(env)) {
    log(`${PREFIX} flock is not installed here: this step runs without the lock ${lock}.`);
    result = supervised(null, '/bin/sh', ['-c', command], { cwd, env });
  } else {
    const free = spawnSync('flock', ['--nonblock', lock, 'true'], { env, stdio: 'ignore' });
    if (free.error || free.status !== 0) log(`${PREFIX} waiting for lock ${lock} (another heavy check runs on this machine)...`);
    result = supervised(lock, '/bin/sh', ['-c', command], { cwd, env: { ...env, [HEAVY_LOCK_HELD]: lock } });
  }
  // A step killed by a signal (directly, or through flock as 128 + signal) failed.
  const killed = result.signal ?? (result.status > 128 ? `signal ${result.status - 128}` : null);
  if (killed) log(`${PREFIX} the step was killed (${killed}): it counts as failed.`);
  const status = result.error || result.signal ? 1 : (result.status ?? 1);
  return { status: status === 0 && killed ? 1 : status, durationMs: Date.now() - started, killed };
}

function quiet(command, { cwd, env }) {
  const result = spawnSync(command, { cwd, env, shell: true, stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function sameLockfile(git, root, sha, config) {
  if (!config.deps.lockfile) return true;
  const committed = git(['rev-parse', `${sha}:${config.deps.lockfile}`], { allowFailure: true });
  const local = path.join(root, config.deps.lockfile);
  if (!committed || !existsSync(local)) return false;
  return git(['hash-object', local]) === committed;
}

const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];

/**
 * Package directories at <sha> whose node_modules exists in the main checkout.
 * A nested project with its own lockfile is linked only when that lockfile is
 * the same in the checkout.
 */
function linkableNodeModules(files, root, git, log) {
  const blobs = new Map(files.map((entry) => [entry.path, entry.object]));
  const dirs = new Set(['']);
  for (const entry of files) {
    if (entry.path === 'package.json' || entry.path.endsWith('/package.json')) {
      if (entry.path.includes('node_modules/')) continue;
      dirs.add(path.posix.dirname(entry.path) === '.' ? '' : path.posix.dirname(entry.path));
    }
  }
  return [...dirs].filter((dir) => {
    if (!existsSync(path.join(root, dir, 'node_modules'))) return false;
    if (dir === '') return true;
    for (const name of LOCKFILES) {
      const committed = blobs.get(`${dir}/${name}`);
      if (!committed) continue;
      const local = path.join(root, dir, name);
      if (!existsSync(local) || git(['hash-object', local]) !== committed) {
        log(`${PREFIX} ${dir}/node_modules not linked: ${dir}/${name} differs from the checkout.`);
        return false;
      }
    }
    return true;
  });
}

/**
 * Give the isolated copy the main checkout's installed packages without
 * copying them: node_modules becomes a real directory of links to the main
 * checkout's entries. A workspace package link (it resolves inside the
 * repository, outside node_modules) is pointed at the isolated copy instead,
 * so the checks see the verified sources of every workspace package.
 */
export function linkNodeModules(from, to, root, copy) {
  const realRoot = realpathSync(root);
  const realModules = path.join(realRoot, 'node_modules');
  mkdirSync(to, { recursive: true });
  const linkEntry = (source, target) => {
    let destination = source;
    if (lstatSync(source).isSymbolicLink()) {
      let real = null;
      try {
        real = realpathSync(source);
      } catch {
        real = null;
      }
      const relative = real ? path.relative(realRoot, real) : '';
      const insideRepository = real && relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      const insideModules = real && !path.relative(realModules, real).startsWith('..');
      if (insideRepository && !insideModules && !relative.split(path.sep).includes('node_modules')) {
        destination = path.join(copy, relative);
      }
    }
    symlinkSync(destination, target, 'dir');
  };
  for (const name of readdirSync(from)) {
    const source = path.join(from, name);
    const target = path.join(to, name);
    if (name.startsWith('@') && lstatSync(source).isDirectory()) {
      mkdirSync(target, { recursive: true });
      for (const child of readdirSync(source)) linkEntry(path.join(source, child), path.join(target, child));
    } else {
      linkEntry(source, target);
    }
  }
}

export function prepareWorktree({ git, root, sha, files, config, env, log, worktreeRoot }) {
  const base = worktreeRoot ?? path.join(os.tmpdir(), 'verify-local');
  mkdirSync(base, { recursive: true });
  const dir = path.join(base, `${path.basename(root)}-${sha.slice(0, 12)}-${randomBytes(3).toString('hex')}`);
  git(['worktree', 'prune'], { allowFailure: true });
  git(['worktree', 'add', '--detach', '--quiet', dir, sha]);
  // Its own temporary directory, beside it: caches kept in TMPDIR (Metro,
  // Babel) cannot serve a file built for another copy.
  const tmp = `${dir}.tmp`;
  mkdirSync(tmp, { recursive: true });
  env = { ...env, TMPDIR: tmp, TMP: tmp, TEMP: tmp };

  for (const relative of config.deps.copy) {
    const from = path.join(root, relative);
    if (existsSync(from)) {
      mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
      writeFileSync(path.join(dir, relative), readFileSync(from));
    }
  }

  let deps = 'none';
  let linked = [];
  const linkable = config.deps.mode === 'link' && sameLockfile(git, root, sha, config);
  if (linkable) {
    const dirs = linkableNodeModules(files, root, git, log);
    for (const relative of dirs) {
      linkNodeModules(path.join(root, relative, 'node_modules'), path.join(dir, relative, 'node_modules'), root, dir);
    }
    linked = dirs;
    deps = `linked ${dirs.length} node_modules from ${root} (same ${config.deps.lockfile ?? 'lockfile'})`;
  } else if (config.deps.install) {
    const reason = config.deps.mode === 'link' ? `${config.deps.lockfile} differs from ${root}` : 'install mode';
    log(`${PREFIX} installing dependencies in the isolated copy (${reason}).`);
    const installed = runShell(config.deps.install, { cwd: dir, env, log });
    if (installed.status !== 0) {
      return { dir, tmp, error: `dependency install failed (${config.deps.install})` };
    }
    deps = `installed with ${config.deps.install} (${Math.round(installed.durationMs / 1000)} s)`;
  }
  log(`${PREFIX} isolated copy ${dir}: ${deps}.`);

  for (const command of config.setup) {
    const result = runShell(command, { cwd: dir, env, log });
    if (result.status !== 0) return { dir, tmp, error: `setup step failed (${command})` };
  }
  return { dir, deps, linked, tmp };
}

/** Replace linked node_modules with a real install, for a check that cannot run on links. */
function installInWorktree(worktree, config, env, log) {
  if (!worktree.linked?.length) return null;
  if (!config.deps.install) return 'this check needs a real install, and deps.install is not set';
  for (const relative of worktree.linked) {
    // Only links live in these directories; rm never follows them.
    rmSync(path.join(worktree.dir, relative, 'node_modules'), { recursive: true, force: true });
  }
  worktree.linked = [];
  log(`${PREFIX} installing dependencies in the isolated copy (a check needs a real install).`);
  const installed = runShell(config.deps.install, { cwd: worktree.dir, env, log });
  if (installed.status !== 0) return `dependency install failed (${config.deps.install})`;
  worktree.deps = `installed with ${config.deps.install} (${Math.round(installed.durationMs / 1000)} s)`;
  return null;
}

function removeWorktree(git, dir) {
  git(['worktree', 'remove', '--force', dir], { allowFailure: true });
  rmSync(dir, { recursive: true, force: true });
  rmSync(`${dir}.tmp`, { recursive: true, force: true });
  git(['worktree', 'prune'], { allowFailure: true });
}

// ---------------------------------------------------------------- verify

function parseArgs(argv) {
  const options = { rev: 'HEAD', targets: [], external: {}, force: false, keep: false, json: false, rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      i += 1;
      return argv[i];
    };
    if (arg === '--rev') options.rev = value();
    else if (arg === '--target') options.targets.push(value());
    else if (arg === '--external') {
      const raw = value();
      const equals = raw.indexOf('=');
      if (equals <= 0 || equals === raw.length - 1) throw new UsageError('--external needs <check>=<evidence>.');
      options.external[raw.slice(0, equals)] = raw.slice(equals + 1);
    } else if (arg === '--force') options.force = true;
    else if (arg === '--keep') options.keep = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--') continue;
    else options.rest.push(arg);
  }
  return options;
}

function selectChecks(config, kind, targets) {
  return config.checks.filter((check) => {
    if (!check.kinds.includes(kind)) return false;
    if (!check.targets) return true;
    return kind === 'release' && check.targets.some((target) => targets.includes(target));
  });
}

const HEX40 = /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/gi;

const HTTPS_URL = /https:\/\/\S+/gi;

/**
 * Why an https:// URL cannot be compared with an externalSources prefix, or
 * null when it can: it must parse, with no user info, no port other than the
 * default, no query or fragment, no backslash, and no dot segment, raw or
 * percent-encoded in any case (nor an encoded separator), so that the parsed
 * URL is the URL as written and a prefix cannot be escaped.
 */
export function externalUrlIssue(raw) {
  const text = String(raw);
  if (text.includes('\\')) return 'it has a backslash';
  if (/%(2e|2f|5c)/i.test(text)) return 'it has a percent-encoded dot or path separator';
  if (text.includes('%')) return 'it has percent-encoding (a run URL needs none)';
  let url;
  try {
    url = new URL(text);
  } catch {
    return 'it is not a valid URL';
  }
  if (url.protocol !== 'https:') return 'it is not an https:// URL';
  const authority = text.replace(/^https:\/\//i, '').split(/[/?#]/)[0];
  if (url.username || url.password || authority.includes('@')) return 'it has user info';
  if (url.port !== '') return `it has a non-default port (${url.port})`;
  if (url.hostname.endsWith('.')) return 'its host ends with a dot';
  if (url.search || url.hash || /[?#]/.test(text)) return 'it has a query or fragment';
  const rawPath = text.replace(/^https:\/\/[^/]*/i, '');
  if (rawPath.split('/').some((segment) => segment === '.' || segment === '..')) return 'it has a dot segment';
  if (rawPath.includes('//')) return 'it has an empty path segment';
  return null;
}

/**
 * Where a clean URL sits against a prefix: 'run' when it has the same origin
 * and at least one path segment after the prefix path (on a segment
 * boundary), 'bare' when it is the prefix itself (it cites no run), else null.
 */
function underSource(raw, prefix) {
  const url = new URL(raw);
  const source = new URL(prefix);
  if (url.origin !== source.origin) return null;
  const base = source.pathname.endsWith('/') ? source.pathname : `${source.pathname}/`;
  if (url.pathname === source.pathname || url.pathname === base) return 'bare';
  return url.pathname.startsWith(base) ? 'run' : null;
}
const OWNER_MACHINE = /^owner-machine: \S+ \S.*? on [0-9a-f]{40}$/;

/**
 * Why external evidence cannot stand for this commit, or null when it can.
 * `sources` is the config's externalSources: https:// URL prefixes of the
 * external CI runs this repository accepts (none by default). The evidence
 * starts with `owner-machine:` (a fixed keyword: a run on the machine that ran
 * the check, named as <host>) or cites a run
 * under a listed source; every https:// URL in it is under a listed source,
 * and it has no http:// URL. It names the full verified head SHA exactly
 * once, in lowercase as git prints it, with no other full SHA (any 40-hex
 * run in any case counts as another SHA, an uppercase copy of the head too): "owner-machine: <host> <note> on <sha>". A
 * squash with the same tree is another commit: it reruns the check or cites
 * evidence for its own SHA.
 */
export function externalEvidenceIssue(_git, evidence, sha, _tree, sources = []) {
  const text = typeof evidence === 'string' ? evidence : '';
  const commit = String(sha);
  const example = `"owner-machine: <host> <note> on ${commit}"`;
  if (/http:\/\//i.test(text)) return `it contains an http:// URL; cite ${example}`;
  const urls = text.match(HTTPS_URL) ?? [];
  if (urls.length && sources.length) {
    for (const url of urls) {
      const issue = externalUrlIssue(url);
      if (issue) return `${url} is refused: ${issue}`;
    }
  }
  const bare = urls.find((url) => !externalUrlIssue(url) && sources.some((prefix) => underSource(url, prefix) === 'bare'));
  if (bare) return `${bare} cites no run: name the run under the listed source`;
  const unlisted = urls.find((url) => !sources.some((prefix) => !externalUrlIssue(url) && underSource(url, prefix) === 'run'));
  if (unlisted) {
    return sources.length
      ? `${unlisted} is not under an external CI source of externalSources in ${CONFIG_FILE} (${sources.join(', ')})`
      : `${unlisted} is not accepted: externalSources in ${CONFIG_FILE} lists no external CI (External CI: none), so cite ${example}`;
  }
  if (!/^owner-machine:\s*\S/.test(text) && urls.length === 0) {
    return `it neither starts with "owner-machine:" nor cites a run of a listed external CI source; cite ${example}`;
  }
  // Every 40-hex run, in any case, is a SHA; only the head as git prints it
  // (lowercase) is the verified commit, compared without case folding.
  const hashes = text.match(HEX40) ?? [];
  const other = hashes.find((found) => found !== commit);
  if (other) {
    return other.toLowerCase() === commit
      ? `it names ${other}, the verified commit in another case; cite it in lowercase as ${commit}`
      : `it names ${other}, which is not the verified commit ${commit}`;
  }
  if (hashes.length === 0) return `it does not name the verified commit ${commit} in full`;
  if (hashes.length > 1) return `it names the verified commit ${hashes.length} times; name it once`;
  // Owner-machine evidence has exactly this shape: a host token, a free-text
  // note, and " on <full head SHA>" at the end.
  if (text.startsWith('owner-machine:') && !OWNER_MACHINE.test(text)) {
    return `owner-machine evidence must read exactly ${example} (a host, a note, then " on " and the full SHA at the end)`;
  }
  return null;
}

/** The externalSources of the config committed at HEAD, for a deploy guard. */
export async function loadExternalSources({ cwd = process.cwd(), env = cleanGitEnv() } = {}) {
  const { git } = resolveRepository(cwd, env);
  return (await loadConfig(git, 'HEAD')).externalSources;
}

export async function verify(kind, argv = [], {
  cwd = process.cwd(),
  env = cleanGitEnv(),
  log = (line) => console.log(line),
  worktreeRoot,
  now = () => new Date(),
  proofLock = {},
} = {}) {
  const options = parseArgs(argv);
  if (options.rest.length) throw new UsageError(`unknown argument ${options.rest[0]}.`);
  const { root, commonDir, git } = resolveRepository(cwd, env);
  const sha = git(['rev-parse', '--verify', `${options.rev}^{commit}`]);
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  const config = await loadConfig(git, sha);
  // A base for "changed since" or an affected range set by the caller would
  // narrow what a check runs: the checks never see it. A check that needs one
  // declares it in its own env.
  const narrowing = [...new Set([...SCOPE_ENV, ...config.stripEnv])].filter((name) => env[name] !== undefined);
  if (narrowing.length) {
    env = { ...env };
    for (const name of narrowing) delete env[name];
    log(`${PREFIX} ignored ${narrowing.join(', ')} from the environment: they narrow what a check runs.`);
  }
  const targets = [...new Set(options.targets)].sort();
  const knownTargets = new Set(config.checks.flatMap((check) => check.targets ?? []));
  for (const target of targets) {
    if (!knownTargets.has(target)) throw new UsageError(`unknown target ${target} (known: ${[...knownTargets].join(', ') || 'none'}).`);
  }
  if (kind === 'pr' && targets.length) throw new UsageError('--target applies to release only.');

  const startedAt = now().toISOString();
  const base = resolveBase(git, config);
  const scope = changedFiles(git, base, sha);
  const files = listTreeFiles(git, sha);
  const environment = {
    node: process.version,
    packageManager: packageManagerOf(git, sha, config, env),
    lockfile: lockfileBlob(git, sha, config),
  };
  // A release reuses nothing: every release check runs on the delivered commit.
  const proofs = options.force || kind === 'release' ? [] : listProofs(commonDir);
  const command = config.commands[kind];
  log(`${PREFIX} ${command} on ${sha} (tree ${tree.slice(0, 12)}, base ${base.ref} ${base.sha ? base.sha.slice(0, 12) : 'unknown'}).`);

  // --external stands in for a specialised check that cannot run here, and
  // only with evidence for this exact head commit. Anything else writes no proof.
  const selected = selectChecks(config, kind, targets);
  // The probe runs in the main checkout, before any isolated copy exists.
  const probes = new Map();
  const probe = (check) => {
    if (!probes.has(check.name)) probes.set(check.name, quiet(check.requires.command, { cwd: root, env }));
    return probes.get(check.name);
  };
  for (const [name, evidence] of Object.entries(options.external)) {
    const check = selected.find((candidate) => candidate.name === name);
    if (!check) throw new UsageError(`--external ${name}: no such ${kind} check.`);
    if (!check.specialised || !check.requires) {
      throw new UsageError(`--external ${name}: only a specialised check with a requires probe can come from elsewhere; run it here.`);
    }
    const issue = externalEvidenceIssue(git, evidence, sha, tree, config.externalSources);
    if (issue) throw new UsageError(`--external ${name}: evidence refused, ${issue}.`);
    if (probe(check)) throw new UsageError(`--external ${name}: this machine can run it (\`${check.requires.command}\` succeeds); run it here instead.`);
  }

  // A check that is open on this commit (its latest real result here did not
  // pass) is never reused: only a run that really reruns it can close it.
  const openItems = openChecks(readRunLog(commonDir, sha), config.checks.map((check) => check.name));
  const open = new Set(openItems.map((item) => item.check));
  const results = [];
  let worktree = null;
  let failed = false;
  let incomplete = false;

  try {
    for (const check of selected) {
      const fingerprint = checkFingerprint({ check, files, tree, sha, environment, mergeBase: scope?.mergeBase ?? null });
      const entry = { name: check.name, command: check.command, fingerprint, specialised: check.specialised };
      if (check.targets) entry.targets = check.targets;

      // `when` narrows a PR to the paths it changes; a release runs every check.
      if (check.when && kind === 'pr') {
        const touched = scope ? scope.files.filter((file) => matchesAny(file, check.when)) : null;
        if (touched && touched.length === 0) {
          results.push({ ...entry, result: 'skipped', reason: `no change under ${check.when.join(', ')} since ${base.ref}` });
          log(`${PREFIX} ${check.name}: out of scope (no change under ${check.when.join(', ')}).`);
          continue;
        }
      }
      // A PR reuses a result whose inputs are identical, from any tree; a
      // release has no proofs to reuse.
      const reusable = open.has(check.name) ? null : findReusable(proofs, fingerprint);
      if (reusable) {
        results.push({ ...entry, result: 'passed', reused: true, reusedFrom: reusable });
        log(`${PREFIX} ${check.name}: reused (same inputs passed on ${reusable.sha.slice(0, 12)}).`);
        continue;
      }
      if (check.requires && !probe(check)) {
        if (options.external[check.name]) {
          results.push({ ...entry, result: 'passed', external: options.external[check.name] });
          log(`${PREFIX} ${check.name}: cannot run here, passed elsewhere (${options.external[check.name]}).`);
          continue;
        }
        incomplete = true;
        const hint = check.requires.hint ?? 'run it where it can run, then pass --external';
        results.push({ ...entry, result: 'unavailable', reason: `\`${check.requires.command}\` failed here: ${hint}` });
        log(`${PREFIX} ${check.name}: cannot run here (\`${check.requires.command}\` failed). ${hint}.`);
        continue;
      }

      if (!worktree) {
        // Checks may keep caches (Turbo, ESLint) in the shared git directory.
        const shared = { VERIFY_LOCAL_COMMON_DIR: commonDir, VERIFY_LOCAL_ROOT: root };
        worktree = prepareWorktree({ git, root, sha, files, config, env: { ...env, ...shared }, log, worktreeRoot });
        worktree.env = { ...shared, TMPDIR: worktree.tmp, TMP: worktree.tmp, TEMP: worktree.tmp };
        if (worktree.error) {
          failed = true;
          results.push({ ...entry, result: 'failed', reason: worktree.error });
          log(`${PREFIX} ${worktree.error}.`);
          break;
        }
      }
      if (check.install) {
        const installError = installInWorktree(worktree, config, { ...env, ...worktree.env }, log);
        if (installError) {
          failed = true;
          results.push({ ...entry, result: 'failed', reason: installError });
          log(`${PREFIX} ${installError}.`);
          break;
        }
      }
      const run = runShell(check.command, {
        cwd: worktree.dir,
        env: { ...env, ...check.env, ...worktree.env, VERIFY_LOCAL_KIND: kind, VERIFY_LOCAL_SHA: sha, VERIFY_LOCAL_TREE: tree },
        log,
      });
      const passed = run.status === 0;
      results.push({ ...entry, result: passed ? 'passed' : 'failed', durationMs: run.durationMs, ...(run.killed ? { reason: `killed (${run.killed})` } : {}) });
      log(`${PREFIX} ${check.name}: ${passed ? 'passed' : `failed (exit ${run.status})`} in ${Math.round(run.durationMs / 1000)} s.`);
      if (!passed) {
        failed = true;
        break;
      }
    }
  } finally {
    if (worktree?.dir) {
      if (options.keep || (failed && process.env.VERIFY_LOCAL_KEEP_FAILED === '1')) {
        log(`${PREFIX} isolated copy kept at ${worktree.dir}.`);
      } else {
        removeWorktree(git, worktree.dir);
      }
    }
  }

  const result = failed ? 'failed' : incomplete ? 'incomplete' : 'passed';
  const proof = {
    version: PROOF_FORMAT_VERSION,
    rule: RULE,
    kind,
    sha,
    tree,
    // Always true: the checks ran on the committed tree of <sha>, in an
    // isolated copy, never on a working tree.
    clean: true,
    result,
    startedAt,
    finishedAt: now().toISOString(),
    command,
    node: environment.node,
    packageManager: environment.packageManager,
    base: { ref: base.ref, sha: base.sha, mergeBase: scope?.mergeBase ?? null },
    targets: kind === 'release' ? targets : [],
    checks: results,
  };

  // Every run is appended to the commit's run log, and the tree's proof is
  // re-read and written, under the short proof lock, so concurrent runs never
  // lose a result. A passed proof is never replaced by a weaker one (a run
  // that fails or is incomplete, or a PR run over a release proof): such a run
  // is kept beside it as <tree>.<kind>-attempt.<sha>.json, unless a passed run
  // of the same kind is already there; the run log keeps every result anyway.
  // A rerun that only reused this tree's own results leaves the proof as it is.
  const entry = {
    kind, sha, tree, result, targets: proof.targets, startedAt, finishedAt: proof.finishedAt,
    known: config.checks.map((check) => check.name),
    checks: results.map((check) => ({ name: check.name, result: check.result, ...(check.reused ? { reused: true } : {}), ...(check.external ? { external: true } : {}) })),
  };
  const locked = withProofLock(commonDir, () => {
    const existing = readProof(commonDir, tree);
    const existingPassed = existing?.result === 'passed';
    const weaker = existingPassed && (result !== 'passed' || (kind === 'pr' && existing.kind === 'release'));
    const nothingNew = existingPassed && result === 'passed' && existing.kind === kind && existing.sha === sha
      && (kind === 'pr' || targets.every((target) => (existing.targets ?? []).includes(target)))
      && results.every((check) => check.result === 'skipped' || (check.reused && check.reusedFrom?.tree === tree));
    const dir = proofsDir(commonDir);
    appendRun(commonDir, sha, entry);
    if (weaker) {
      const beside = attemptName(tree, kind, sha);
      if (result !== 'passed' && readProof(commonDir, tree, beside)?.result === 'passed') {
        log(`${PREFIX} the passed ${kind} run of this commit is kept; this ${kind} run (${result}) is in its run log.`);
        return { proofFile: path.join(dir, runLogName(sha)), kept: existing };
      }
      log(`${PREFIX} the passed ${existing.kind} proof of this tree is kept; this ${kind} run (${result}) is recorded beside it.`);
      return { proofFile: writeProof(commonDir, proof, beside), kept: existing };
    }
    if (nothingNew) {
      log(`${PREFIX} every check had already passed on this tree; the proof is unchanged.`);
      return { proofFile: path.join(dir, `${tree}.json`), kept: existing };
    }
    if (kind === 'release' && existing?.kind === 'release' && existingPassed && existing.sha === sha && result === 'passed') {
      proof.targets = [...new Set([...existing.targets, ...targets])].sort();
      const names = new Set(results.map((check) => check.name));
      proof.checks = [...results, ...existing.checks.filter((check) => !names.has(check.name))];
    }
    return { proofFile: writeProof(commonDir, proof), kept: null };
  }, proofLock);
  if (!locked.locked) {
    // Never a pass without the lock: the result still goes to the run log
    // (an append is one write), the proof is left as it is, and the run fails.
    appendRun(commonDir, sha, { ...entry, proofLock: 'timeout' });
    log(`${PREFIX} the proof lock ${path.join(proofsDir(commonDir), '.proof.lock')} is still held after ${Math.round((proofLock.waitMs ?? PROOF_LOCK_WAIT_MS) / 1000)} s: this ${result} run is in the run log, the proof is unchanged, and the run counts as failed. Rerun it.`);
    return { status: 1, proof: null };
  }
  const { proofFile, kept } = locked.value;
  const ran = results.filter((check) => check.durationMs !== undefined).length;
  const reused = results.filter((check) => check.reused).length;
  log(`${PREFIX} ${result}: ${ran} run, ${reused} reused, ${results.filter((check) => check.result === 'skipped').length} out of scope. Proof: ${proofFile}.`);
  if (incomplete && !failed) {
    log(`${PREFIX} incomplete: run the unavailable checks on a machine that can run them (or a listed external CI, on demand), then rerun with --external <check>=<evidence> from the machine that ran the check.`);
  }
  return { status: failed ? 1 : incomplete ? 2 : 0, proof: kept ?? proof };
}

// ---------------------------------------------------------------- deploy guard

/** Every check of checkReleaseProof, in order (deploy guards list them). */
export const RELEASE_PROOF_CHECKS = Object.freeze([
  'head-is-origin-main',
  'clean-tree',
  'proof-present',
  'proof-kind',
  'proof-passed',
  'proof-matches-head',
  'proof-latest-release',
  'proof-open-check',
  'proof-target',
  'proof-external',
]);

/**
 * Release proof a deploy of HEAD needs: HEAD is origin/<main>, the checkout is
 * clean, and a passed release proof exists for this exact commit and tree
 * (and for every requested target). Returns the list of failures.
 */
export function checkReleaseProof({ cwd = process.cwd(), env = cleanGitEnv(), targets = [], fetch = true, mainBranch = 'main', externalSources = [] } = {}) {
  const { commonDir, git } = resolveRepository(cwd, env);
  const failures = [];
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  if (fetch) {
    if (git(['fetch', '--quiet', 'origin', `+refs/heads/${mainBranch}:refs/remotes/origin/${mainBranch}`], { allowFailure: true }) === null) {
      failures.push({ check: 'head-is-origin-main', message: `git fetch origin ${mainBranch} failed` });
    }
  }
  const main = git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${mainBranch}^{commit}`], { allowFailure: true });
  if (!main) failures.push({ check: 'head-is-origin-main', message: `origin/${mainBranch} does not exist in this clone` });
  else if (main !== head) failures.push({ check: 'head-is-origin-main', message: `HEAD ${head} is not origin/${mainBranch} ${main}` });
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=all']);
  if (dirty) failures.push({ check: 'clean-tree', message: `the checkout has changes (${dirty.split('\n').length} paths)` });
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const proof = readProof(commonDir, tree);
  if (!proof) {
    const older = proofFileVersion(commonDir, tree);
    failures.push({
      check: 'proof-present',
      message: older === null
        ? `no proof for tree ${tree}; run verify:release on HEAD`
        : `the proof for tree ${tree} has format ${older}, older than ${PROOF_FORMAT_VERSION}; run verify:release on HEAD again`,
    });
  } else {
    if (proof.kind !== 'release') failures.push({ check: 'proof-kind', message: `the proof is a ${proof.kind} proof; only a release proof unlocks a deploy` });
    if (proof.result !== 'passed') failures.push({ check: 'proof-passed', message: `the proof result is ${proof.result}` });
    if (proof.sha !== head) failures.push({ check: 'proof-matches-head', message: `the proof was written for ${proof.sha}, not HEAD ${head}; run verify:release on HEAD (identical checks are reused)` });
    // The run log of HEAD, in the order runs ended: its latest release run must
    // have passed with every check really run, and no check may be open (its
    // latest real result failed, was killed or unavailable), whatever the times.
    const runs = readRunLog(commonDir, head);
    const latest = runs.filter((entry) => entry.kind === 'release').at(-1);
    if (!latest) failures.push({ check: 'proof-latest-release', message: `no release run of ${head} in its run log; run verify:release on HEAD` });
    else if (latest.result !== 'passed' || latest.checks.some((check) => check.reused)) {
      failures.push({ check: 'proof-latest-release', message: `the latest release run of ${head} ${latest.result === 'passed' ? 'reused results' : latest.result} at ${latest.finishedAt}; run verify:release on HEAD again` });
    }
    const open = openChecks(runs);
    if (open.length) failures.push({ check: 'proof-open-check', message: `open on ${head}: ${describeOpen(open)}; a run that really reruns them must pass, then verify:release on HEAD` });
    for (const target of targets) {
      if (!(proof.targets ?? []).includes(target)) failures.push({ check: 'proof-target', message: `the proof does not cover target ${target}` });
    }
    for (const check of proof.checks ?? []) {
      if (!check.external) continue;
      const issue = !check.specialised
        ? 'only a specialised check can come from elsewhere'
        : externalEvidenceIssue(git, String(check.external), proof.sha, proof.tree, externalSources);
      if (issue) failures.push({ check: 'proof-external', message: `${check.name}: ${issue}` });
    }
  }
  return { head, tree, proof, failures };
}

// ---------------------------------------------------------------- status and PR block

function countChecks(proof) {
  const counts = { run: 0, reused: 0, skipped: 0, external: 0 };
  for (const check of proof.checks ?? []) {
    if (check.result === 'skipped') counts.skipped += 1;
    else if (check.external) counts.external += 1;
    else if (check.reused) counts.reused += 1;
    else if (check.durationMs !== undefined) counts.run += 1;
  }
  return `${counts.run} run, ${counts.reused} reused, ${counts.skipped} out of scope${counts.external ? `, ${counts.external} external` : ''}`;
}

function externalEvidence(proof) {
  return (proof.checks ?? []).filter((check) => check.external).map((check) => `${check.name} (${check.external})`);
}

function describeProof(proof) {
  const external = externalEvidence(proof);
  return `${proof.kind} proof ${proof.result} (${countChecks(proof)}) on ${proof.sha.slice(0, 12)} at ${proof.finishedAt}${external.length ? `; external: ${external.join('; ')}` : ''}`;
}

export async function status(argv = [], { cwd = process.cwd(), env = cleanGitEnv(), log = (line) => console.log(line) } = {}) {
  const options = parseArgs(argv);
  const { commonDir, git } = resolveRepository(cwd, env);
  const sha = git(['rev-parse', '--verify', `${options.rev}^{commit}`]);
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  const proof = readProofFor(commonDir, tree, sha);
  const open = openChecks(readRunLog(commonDir, sha));
  if (options.json) log(JSON.stringify(proof ? { ...proof, openChecks: open } : null, null, 2));
  else if (!proof) log(`${PREFIX} tree ${tree.slice(0, 12)}: no proof yet${open.length ? `; open on this commit: ${describeOpen(open)}` : ''}.`);
  else {
    log(`${PREFIX} tree ${tree.slice(0, 12)}: ${describeProof(proof)}${openSuffix(commonDir, sha)}.`);
  }
  return { status: 0, proof };
}

export async function proofBlock(argv = [], { cwd = process.cwd(), env = cleanGitEnv(), log = (line) => console.log(line) } = {}) {
  const options = parseArgs(argv);
  const { commonDir, git } = resolveRepository(cwd, env);
  const sha = git(['rev-parse', '--verify', `${options.rev}^{commit}`]);
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  const proof = readProofFor(commonDir, tree, sha);
  if (!proof) {
    log(`${PREFIX} no proof for tree ${tree}; run verify:pr first.`);
    return { status: 1 };
  }
  const config = await loadConfig(git, sha);
  const checks = proof.checks ?? [];
  const specialisedRun = checks.filter((check) => check.specialised && check.result === 'passed')
    .map((check) => (check.external ? `${check.name} (${check.external})` : check.name));
  const specialisedOut = checks.filter((check) => check.specialised && check.result === 'skipped').map((check) => check.name);
  const specialisedMissing = checks.filter((check) => check.specialised && check.result === 'unavailable').map((check) => check.name);
  const base = resolveBase(git, config);
  const replayed = checks.filter((check) => check.durationMs !== undefined).map((check) => check.name);
  const reusedOther = checks.filter((check) => check.reused && check.reusedFrom?.tree !== tree).map((check) => check.name);
  let integration;
  if (proof.base?.sha && base.sha && proof.base.sha !== base.sha) {
    integration = `base moved since the proof (${proof.base.sha.slice(0, 12)} -> ${base.sha.slice(0, 12)}): merge it and rerun ${proof.command}`;
  } else if (reusedOther.length) {
    integration = `base ${base.ref} ${(base.sha ?? '').slice(0, 12)}; checks replayed: ${replayed.join(', ') || 'none'}; reused from an identical earlier input: ${reusedOther.join(', ')}`;
  } else {
    integration = `base unchanged (${base.ref} ${(base.sha ?? '').slice(0, 12)})`;
  }
  const lines = [
    '## Local proof',
    `- Commands: \`${proof.command}\``,
    `- Commit SHA: \`${proof.sha}\``,
    `- Result: ${proof.result}, ${proof.kind} proof (${countChecks(proof)})`,
    `- Tree (\`git rev-parse <sha>^{tree}\`): \`${proof.tree}\``,
    `- Specialised checks (database, browser, mobile, corpus): run: ${specialisedRun.join(', ') || 'none'} / out of scope: ${specialisedOut.join(', ') || 'none'}${specialisedMissing.length ? ` / still needed: ${specialisedMissing.join(', ')}` : ''}`,
    `- Integration: ${integration}`,
  ];
  const external = externalEvidence(proof);
  if (external.length) lines.push(`- External evidence: ${external.join('; ')}`);
  const open = openChecks(readRunLog(commonDir, proof.sha));
  if (open.length) lines.push(`- Open on this commit: ${describeOpen(open)}; a run that really reruns them must pass`);
  // A PR can change its own checks or hook rules: say so, for the owner's review.
  const scope = changedFiles(git, base, sha);
  const delivery = (scope?.files ?? []).filter((file) => matchesAny(file, [...DELIVERY_FILES, ...config.deliveryFiles]));
  // Every package.json the PR changes, root and workspaces: its scripts are
  // what the checks run, and it can hold tool config (jest, eslintConfig,
  // prettier, babel). Only a dependency or version change goes unflagged.
  for (const manifest of (scope?.files ?? []).filter((file) => file === 'package.json' || file.endsWith('/package.json'))) {
    if (!manifest.includes('node_modules/') && manifestChanged(git, scope.mergeBase, sha, manifest)) delivery.push(manifest);
  }
  if (delivery.length) lines.push(`- Delivery checks changed: ${delivery.join(', ')} (needs the owner's review)`);
  log(lines.join('\n'));
  return { status: proof.result === 'passed' ? 0 : 1, proof };
}

// ---------------------------------------------------------------- pre-push hook

/** Fields of a package.json that only pick dependencies; the lockfile is in every fingerprint. */
const MANIFEST_DEPENDENCY_FIELDS = [
  'version',
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'bundleDependencies',
  'bundledDependencies',
];

/** A JSON value with its object keys sorted, so key order alone is no change. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Whether a package.json differs between two commits outside its dependency
 * and version fields: scripts and tool config (jest, eslintConfig, prettier,
 * babel, browserslist, workspaces) decide what the checks run. A file that
 * cannot be parsed counts as changed.
 */
function manifestChanged(git, from, to, manifest = 'package.json') {
  const fields = (rev) => {
    const text = git(['show', `${rev}:${manifest}`], { allowFailure: true });
    try {
      const json = text ? JSON.parse(text) : {};
      for (const field of MANIFEST_DEPENDENCY_FIELDS) delete json[field];
      return canonicalJson(json);
    } catch {
      return null;
    }
  };
  const before = fields(from);
  const after = fields(to);
  return before === null || after === null || before !== after;
}

/**
 * Files that define how a repository is checked; changing them needs the
 * owner's review: the engine, its config and hook, and the configs of the
 * tools the checks run (a weaker lint, type or test config passes more).
 */
export const DELIVERY_FILES = [
  CONFIG_FILE,
  'scripts/verify-local.mjs',
  'scripts/test-verify-local.mjs',
  '.githooks/**',
  'turbo.json',
  '**/eslint.config.*',
  '**/.eslintrc*',
  '**/tsconfig*.json',
  '**/jest.config.*',
  '**/vitest*.config.*',
  '**/playwright*.config.*',
  '**/babel.config.*',
  '**/.prettierrc*',
  '**/prettier.config.*',
  '**/.prettierignore',
  '**/.eslintignore',
  '**/.babelrc*',
  '**/jest.setup.*',
  '**/jest.resolver.*',
  '**/vitest.setup.*',
  '**/vitest.workspace.*',
  '**/e2e*.config.*',
  '**/pnpm-workspace.yaml',
  '**/deno.json',
  '**/deno.jsonc',
  '**/pyproject.toml',
  '**/pytest.ini',
  '**/tox.ini',
  '**/setup.cfg',
];

/**
 * Variables that narrow what a check runs: a "changed since" base (Jest via
 * scripts/run-jest-changed.js), Turbo's --affected range, a CI base revision.
 * A verify run strips them from the caller's environment.
 */
export const SCOPE_ENV = ['JEST_CHANGED_SINCE', 'TURBO_SCM_BASE', 'TURBO_SCM_HEAD', 'CI_BASE_REVISION', 'GITHUB_BASE_SHA'];

export const DEFAULT_FORBIDDEN = [
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.p12',
  '**/*.pfx',
  '**/*.jks',
  '**/*.keystore',
  '**/id_rsa',
  '**/id_ed25519',
  '**/service-account*.json',
];
const DEFAULT_ALLOWED_ENV = ['**/.env.example', '**/.env.*.example', '**/.env.sample', '**/.env.template'];

const SECRET_PATTERNS = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe live key', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/ },
  { name: 'Anthropic key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}/ },
];

const NULL_ID = /^0+$/;

/** Read many blobs with one `git cat-file --batch`; null when git cannot. */
export function readBlobs(root, env, entries) {
  if (entries.length === 0) return [];
  const input = `${entries.map((entry) => entry.object).join('\n')}\n`;
  const result = spawnSync('git', ['cat-file', '--batch'], { cwd: root, env, input, maxBuffer: 512 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  const output = result.stdout;
  const blobs = [];
  let offset = 0;
  for (const entry of entries) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) return null;
    // "<object> blob <size>", then the content and a newline: anything else
    // (missing object, wrong object or type, short output) fails closed.
    const [object, type, sizeText, extra] = output.subarray(offset, newline).toString('utf8').split(' ');
    const size = Number(sizeText);
    if (object !== entry.object || type !== 'blob' || extra !== undefined || !Number.isInteger(size) || size < 0) return null;
    const end = newline + 1 + size;
    if (end + 1 > output.length || output[end] !== 0x0a) return null;
    blobs.push({ file: entry.file, content: output.subarray(newline + 1, end).toString('utf8') });
    offset = end + 1;
  }
  return blobs;
}

/** Fast checks of what a push sends. Never runs a heavy suite. */
export async function prePush(remote, stdinText, {
  cwd = process.cwd(),
  env = cleanGitEnv(),
  log = (line) => console.log(line),
  error = (line) => console.error(line),
  now = () => Date.now(),
} = {}) {
  const started = now();
  const { root, commonDir, git } = resolveRepository(cwd, env);
  const refs = stdinText.split('\n').map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 4);
  const pushes = [];
  for (const [localRef, localSha, , remoteSha] of refs) {
    if (NULL_ID.test(localSha) || localSha === remoteSha) continue;
    const commit = git(['rev-parse', '--verify', '--quiet', `${localSha}^{commit}`], { allowFailure: true });
    if (!commit) continue; // a tag on a non-commit object
    const fresh = git(['rev-list', '--max-count=1', commit, '--not', `--remotes=${remote}`], { allowFailure: true });
    if (fresh === '') continue;
    pushes.push({ localRef, sha: commit });
  }
  if (pushes.length === 0) {
    log(`${PREFIX} pre-push: nothing new to send; no check run.`);
    return { status: 0 };
  }

  let config = null;
  try {
    config = await loadConfig(git, pushes[0].sha);
  } catch (loadError) {
    config = normaliseConfig({});
    log(`${PREFIX} pre-push: ${loadError.message} Default fast checks only.`);
  }
  const problems = [];
  const head = git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { allowFailure: true });

  for (const push of pushes) {
    // Files the new commits add or change (a merge counts against its first
    // parent), as they stand in the pushed commit.
    const names = git(['log', '--no-renames', '--diff-filter=AMT', '--name-only', '--format=', '-z', '-m', '--first-parent',
      '--max-count=300', push.sha, '--not', `--remotes=${remote}`], { allowFailure: true }) ?? '';
    const changed = new Set(names.split('\0').map((file) => file.replace(/^\n+/, '')).filter(Boolean));
    if (changed.size === 0) continue;
    const entries = new Map();
    const listing = git(['ls-tree', '-r', '-l', '-z', '--full-tree', push.sha]);
    for (const line of listing.split('\0').filter(Boolean)) {
      const tab = line.indexOf('\t');
      const [, type, object, size] = line.slice(0, tab).trim().split(/\s+/);
      if (type === 'blob') entries.set(line.slice(tab + 1), { object, size: Number(size) });
    }
    const toScan = [];
    for (const file of changed) {
      const entry = entries.get(file);
      if (!entry) continue;
      const allowed = matchesAny(file, [...DEFAULT_ALLOWED_ENV, ...config.hook.allow]);
      if (!allowed && matchesAny(file, config.hook.forbidden)) {
        problems.push(`${file}: forbidden file (secrets and keys stay out of git; allow it in ${CONFIG_FILE} hook.allow if it is public)`);
        continue;
      }
      if (config.hook.maxFileBytes && entry.size > config.hook.maxFileBytes) {
        problems.push(`${file}: ${(entry.size / 1024 / 1024).toFixed(1)} MB, over the ${(config.hook.maxFileBytes / 1024 / 1024).toFixed(0)} MB limit of ${CONFIG_FILE}`);
        continue;
      }
      if (entry.size <= 2 * 1024 * 1024 && !matchesAny(file, config.hook.secretAllow)) toScan.push({ file, ...entry });
    }
    const blobs = readBlobs(root, env, toScan);
    if (blobs === null || blobs.length !== toScan.length) {
      problems.push(`could not read the ${toScan.length} pushed files (git cat-file --batch failed), so the secret scan did not run`);
      continue;
    }
    for (const { file, content } of blobs) {
      if (content.includes('\0')) continue;
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          problems.push(`${file}: looks like a ${name}`);
          break;
        }
      }
    }
  }

  for (const check of config.hook.checks) {
    if (pushes.some((push) => push.sha !== head)) {
      log(`${PREFIX} pre-push: ${check.name} skipped (it reads the checkout, and the pushed commit is not HEAD).`);
      continue;
    }
    const result = spawnSync(check.command, { cwd: root, env, shell: true, encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      problems.push(`${check.name} failed:\n${`${result.stdout ?? ''}${result.stderr ?? ''}`.trim()}`);
    }
  }

  for (const push of pushes) {
    const tree = git(['rev-parse', `${push.sha}^{tree}`]);
    const proof = readProofFor(commonDir, tree, push.sha);
    log(proof
      ? `${PREFIX} pre-push: ${push.localRef} ${push.sha.slice(0, 12)}: ${describeProof(proof)}${openSuffix(commonDir, push.sha)}.`
      : `${PREFIX} pre-push: ${push.localRef} ${push.sha.slice(0, 12)}: no proof yet; run ${config.commands.pr} before pushing.`);
  }

  const seconds = ((now() - started) / 1000).toFixed(1);
  if (problems.length) {
    error(`${PREFIX} pre-push: blocked in ${seconds} s:`);
    for (const problem of problems) error(`  - ${problem}`);
    return { status: 1, problems };
  }
  log(`${PREFIX} pre-push: fast checks passed in ${seconds} s.`);
  return { status: 0, problems };
}

// ---------------------------------------------------------------- CLI

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [mode, ...rest] = argv;
  try {
    if (mode === 'pr' || mode === 'release') return (await verify(mode, rest)).status;
    if (mode === 'status') return (await status(rest)).status;
    if (mode === 'proof-block') return (await proofBlock(rest)).status;
    if (mode === 'hook') return (await prePush(rest[0] ?? 'origin', readStdin())).status;
    throw new UsageError('usage: verify-local.mjs <pr|release|status|proof-block|hook> [options]');
  } catch (caught) {
    console.error(`${PREFIX} ${caught.message}`);
    return caught instanceof UsageError ? 64 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
