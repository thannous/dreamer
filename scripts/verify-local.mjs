#!/usr/bin/env node
// Local verification engine of the common delivery rule (regle-commune-livraison v2).
// Canonical rule: https://github.com/thannous/shapier/blob/main/docs/regle-commune-livraison.md
//
// This file is identical in shapier, skillcodex, clawdeals, bodylab and dreamer.
// Each repository describes its checks in verify-local.config.mjs at its root;
// change this engine in all five repositories at once, never in one alone.
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
// (SCOPE_ENV, plus the config's stripEnv). A `when` check runs only if its paths changed
// since origin/<main> (a docs-only PR skips typecheck in a fresh clone). On
// the main commit itself nothing changed: releaseAlways: true makes a release
// run it anyway.
//
// Exit codes: 0 passed, 1 failed, 2 incomplete (a required specialised check
// could not run here; see --external), 64 usage or configuration error.

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
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

export const RULE = 'regle-commune-livraison v2';
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

export function readProof(commonDir, tree) {
  const file = path.join(proofsDir(commonDir), `${tree}.json`);
  if (!existsSync(file)) return null;
  try {
    const proof = JSON.parse(readFileSync(file, 'utf8'));
    return proof && proof.version === PROOF_FORMAT_VERSION ? proof : null;
  } catch {
    return null;
  }
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
    .filter((name) => name.endsWith('.json'))
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

function runShell(command, { cwd, env, log }) {
  log(`${PREFIX} $ ${command}`);
  const started = Date.now();
  const result = spawnSync(command, { cwd, env, shell: true, stdio: 'inherit' });
  const status = result.error ? 1 : (result.status ?? 1);
  return { status, durationMs: Date.now() - started };
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

/**
 * Why external evidence cannot stand for this commit, or null when it can:
 * it gives an https:// location of the run (or starts with `owner-machine:`
 * for a run on the owner's machine), uses no plain-http link, and names
 * exactly one commit: the verified one, or a commit with the same tree.
 */
export function externalEvidenceIssue(git, evidence, sha, tree) {
  if (/\bhttp:\/\//i.test(evidence)) return 'a plain http:// link is not evidence; use https://';
  if (!/https:\/\/[^\s/]+/i.test(evidence) && !/^owner-machine:/.test(evidence)) {
    return 'the evidence must give the https:// location of the run, or start with "owner-machine:" for a run on the owner\'s machine';
  }
  const tokens = (evidence.match(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/gi) ?? []).map((token) => token.toLowerCase());
  if (tokens.length !== 1) {
    return `the evidence must name exactly one commit, the verified ${sha} or one with the same tree (it names ${tokens.length})`;
  }
  const [token] = tokens;
  if (token === sha) return null;
  const commit = git(['rev-parse', '--verify', '--quiet', `${token}^{commit}`], { allowFailure: true });
  if (commit && git(['rev-parse', `${commit}^{tree}`], { allowFailure: true }) === tree) return null;
  return `the evidence names ${token}, which is neither the verified commit nor a commit with the same tree`;
}

export async function verify(kind, argv = [], {
  cwd = process.cwd(),
  env = cleanGitEnv(),
  log = (line) => console.log(line),
  worktreeRoot,
  now = () => new Date(),
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
  // only with evidence naming the verified commit or tree.
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
    const issue = externalEvidenceIssue(git, evidence, sha, tree);
    if (issue) throw new UsageError(`--external ${name}: ${issue}; for example "https://<run URL> on ${sha}" or "owner-machine: <note> on ${sha}".`);
    if (probe(check)) throw new UsageError(`--external ${name}: this machine can run it (\`${check.requires.command}\` succeeds); run it here instead.`);
  }

  const existing = readProof(commonDir, tree);
  const results = [];
  let worktree = null;
  let failed = false;
  let incomplete = false;

  try {
    for (const check of selected) {
      const fingerprint = checkFingerprint({ check, files, tree, sha, environment, mergeBase: scope?.mergeBase ?? null });
      const entry = { name: check.name, command: check.command, fingerprint, specialised: check.specialised };
      if (check.targets) entry.targets = check.targets;

      if (check.when && !(kind === 'release' && check.releaseAlways)) {
        const touched = scope ? scope.files.filter((file) => matchesAny(file, check.when)) : null;
        if (touched && touched.length === 0) {
          results.push({ ...entry, result: 'skipped', reason: `no change under ${check.when.join(', ')} since ${base.ref}` });
          log(`${PREFIX} ${check.name}: out of scope (no change under ${check.when.join(', ')}).`);
          continue;
        }
      }
      // A PR reuses a result whose inputs are identical, from any tree; a
      // release has no proofs to reuse.
      const reusable = findReusable(proofs, fingerprint);
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
      results.push({ ...entry, result: passed ? 'passed' : 'failed', durationMs: run.durationMs });
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

  // A passed proof is never replaced by a weaker one: a run that fails or is
  // incomplete never replaces a passed proof of the same tree, and a PR run
  // never replaces a passed release proof (it also proves the PR). Such a run
  // is kept beside it as <tree>.<kind>-attempt.json, so its passed checks can
  // still be reused. A rerun that only reused this tree's own results leaves
  // the proof as it is, with the checks that really ran.
  const existingPassed = existing?.result === 'passed';
  const weaker = existingPassed && (result !== 'passed' || (kind === 'pr' && existing.kind === 'release'));
  const nothingNew = existingPassed && result === 'passed' && existing.kind === kind && existing.sha === sha
    && (kind === 'pr' || targets.every((target) => (existing.targets ?? []).includes(target)))
    && results.every((check) => check.result === 'skipped' || (check.reused && check.reusedFrom?.tree === tree));
  const keepExisting = weaker || nothingNew;
  if (weaker) {
    writeProof(commonDir, proof, `${tree}.${kind}-attempt.json`);
    log(`${PREFIX} the passed ${existing.kind} proof of this tree is kept; this ${kind} run (${result}) is recorded beside it.`);
  } else if (nothingNew) {
    log(`${PREFIX} every check had already passed on this tree; the proof is unchanged.`);
  } else {
    if (kind === 'release' && existing?.kind === 'release' && existingPassed && existing.sha === sha && result === 'passed') {
      proof.targets = [...new Set([...existing.targets, ...targets])].sort();
      const names = new Set(results.map((check) => check.name));
      proof.checks = [...results, ...existing.checks.filter((check) => !names.has(check.name))];
    }
    writeProof(commonDir, proof);
  }
  const proofFile = path.join(proofsDir(commonDir), weaker ? `${tree}.${kind}-attempt.json` : `${tree}.json`);
  const ran = results.filter((check) => check.durationMs !== undefined).length;
  const reused = results.filter((check) => check.reused).length;
  log(`${PREFIX} ${result}: ${ran} run, ${reused} reused, ${results.filter((check) => check.result === 'skipped').length} out of scope. Proof: ${proofFile}.`);
  if (incomplete && !failed) {
    log(`${PREFIX} incomplete: run the unavailable checks where they can run (remote CI on demand, the owner's machine), then rerun with --external <check>=<evidence>.`);
  }
  return { status: failed ? 1 : incomplete ? 2 : 0, proof: keepExisting ? existing : proof };
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
  'proof-target',
  'proof-external',
]);

/**
 * Release proof a deploy of HEAD needs: HEAD is origin/<main>, the checkout is
 * clean, and a passed release proof exists for this exact commit and tree
 * (and for every requested target). Returns the list of failures.
 */
export function checkReleaseProof({ cwd = process.cwd(), env = cleanGitEnv(), targets = [], fetch = true, mainBranch = 'main' } = {}) {
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
    for (const target of targets) {
      if (!(proof.targets ?? []).includes(target)) failures.push({ check: 'proof-target', message: `the proof does not cover target ${target}` });
    }
    for (const check of proof.checks ?? []) {
      if (!check.external) continue;
      const issue = !check.specialised
        ? 'only a specialised check can come from elsewhere'
        : externalEvidenceIssue(git, String(check.external), proof.sha, proof.tree);
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
  const proof = readProof(commonDir, tree);
  if (options.json) log(JSON.stringify(proof, null, 2));
  else log(proof ? `${PREFIX} tree ${tree.slice(0, 12)}: ${describeProof(proof)}.` : `${PREFIX} tree ${tree.slice(0, 12)}: no proof yet.`);
  return { status: 0, proof };
}

export async function proofBlock(argv = [], { cwd = process.cwd(), env = cleanGitEnv(), log = (line) => console.log(line) } = {}) {
  const options = parseArgs(argv);
  const { commonDir, git } = resolveRepository(cwd, env);
  const sha = git(['rev-parse', '--verify', `${options.rev}^{commit}`]);
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  const proof = readProof(commonDir, tree);
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
    const proof = readProof(commonDir, tree);
    log(proof
      ? `${PREFIX} pre-push: ${push.localRef} ${push.sha.slice(0, 12)}: ${describeProof(proof)}.`
      : `${PREFIX} pre-push: ${push.localRef} ${push.sha.slice(0, 12)}: no proof yet; run ${config.commands.pr} before asking for a merge.`);
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
