'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SCHEMA = 'noctalia.local-workspace/1';
const exists = (file) => {
  try { fs.lstatSync(file); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const inside = (parent, file) => file.startsWith(parent + path.sep);
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
};
function refuse(code) { throw new Error(code); }
function git(repo, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ![
    'GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ].includes(key)));
  const result = spawnSync('git', ['-C', repo, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
    env: { ...env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8',
    // Installed workspaces can have several MiB of ignored dependency paths.
    // Keep the complete inventory so release can validate every declared path.
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) refuse(`GIT_COMMAND_FAILED: ${args[0]}`);
  return result.stdout.trimEnd();
}
function directory(file, create = false) {
  if (!exists(file) && create) fs.mkdirSync(file, { mode: 0o700 });
  const stat = fs.lstatSync(file);
  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('WORKSPACE_SYMLINK_OR_NON_DIRECTORY');
}
// macOS numbers volumes again at boot, so the device alone cannot tell a reboot
// from a replacement. The birth time can, even when ext4 reuses a freed inode;
// without birth times (0), the device check stays strict.
function directoryIdentity(file) {
  directory(file);
  const stat = fs.lstatSync(file, { bigint: true });
  return { device: String(stat.dev), inode: String(stat.ino), birthtime: stat.birthtimeNs > 0n ? String(stat.birthtimeNs) : null };
}
// A receipt from before birth times survives a reboot only for the same inode,
// born before that receipt was last written (or just after: prepare writes it
// before `git worktree add` creates the directory).
const LEGACY_CREATION_GRACE_NS = 60_000_000_000n;
function sameDirectory(recorded, actual, recordedAt) {
  if (recorded.inode !== actual.inode) return false;
  if (typeof recorded.birthtime === 'string') return recorded.birthtime === actual.birthtime;
  if (recorded.device === actual.device) return true;
  if (recorded.birthtime !== undefined || actual.birthtime === null) return false;
  const written = Date.parse(recordedAt);
  return Number.isFinite(written) && BigInt(actual.birthtime) <= BigInt(written) * 1_000_000n + LEGACY_CREATION_GRACE_NS;
}
function assertDirectoryIdentity(ctx, receipt) {
  const actual = directoryIdentity(ctx.path);
  if (!receipt.directoryIdentity) refuse('WORKSPACE_DIRECTORY_IDENTITY_UNPROVEN');
  if (!sameDirectory(receipt.directoryIdentity, actual, receipt.updatedAt)) refuse('WORKSPACE_DIRECTORY_REPLACED');
  // The caller's next receipt write keeps the new device and upgrades a legacy identity.
  receipt.directoryIdentity = actual;
}
const covered = (file, regenerable) => regenerable.some((item) => file === item || file.startsWith(item + '/'));
// Scratch has no git inventory: descend only into the parents of declared paths,
// so a nested declaration such as apps/site/node_modules covers its own files.
function scratchEntries(root, regenerable, prefix = '') {
  return fs.readdirSync(path.join(root, prefix)).flatMap((name) => {
    const entry = prefix ? `${prefix}/${name}` : name;
    if (covered(entry, regenerable) || !regenerable.some((item) => item.startsWith(entry + '/'))) return [entry];
    const stat = fs.lstatSync(path.join(root, entry));
    return stat.isDirectory() && !stat.isSymbolicLink() ? scratchEntries(root, regenerable, entry) : [entry];
  });
}
function json(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}
function regenerablePaths(values) {
  return [...new Set(values.map((value) => {
    const parts = value.replaceAll('\\', '/').split('/');
    if (path.isAbsolute(value) || parts.some((part) => !part || ['.', '..', '.git'].includes(part))) refuse('INVALID_REGENERABLE_PATH');
    return parts.join('/');
  }))].sort();
}
function context(options) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.task ?? '')) refuse('INVALID_WORKSPACE_TASK');
  const projects = path.resolve(options.projects ?? path.join(os.homedir(), 'Projects'));
  directory(projects);
  const projectsRoot = fs.realpathSync(projects);
  const source = fs.realpathSync(path.resolve(options.repo ?? process.cwd()));
  if (!inside(projectsRoot, source) || inside(path.join(projectsRoot, '.workspaces'), source)) refuse('SOURCE_MUST_BE_A_PRIMARY_PROJECT');
  if (fs.realpathSync(git(source, ['rev-parse', '--show-toplevel'])) !== source) refuse('SOURCE_MUST_BE_REPOSITORY_ROOT');
  const sourceGitDir = fs.realpathSync(git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  if (!inside(projectsRoot, sourceGitDir) || sourceGitDir !== path.join(source, '.git')) refuse('SOURCE_MUST_BE_A_PRIMARY_PROJECT');
  const name = path.basename(source).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const base = path.join(projectsRoot, '.workspaces', name);
  const ownerPid = Number(options.ownerPid ?? process.ppid);
  if (!Number.isSafeInteger(ownerPid) || ownerPid < 2) refuse('INVALID_WORKSPACE_OWNER');
  return { source, sourceGitDir, base, task: options.task, ownerPid,
    path: path.join(base, options.task), receipt: path.join(base, `.${options.task}.json`),
    lock: path.join(base, `.${options.task}.lock`), uid: process.getuid?.() ?? null };
}
function readReceipt(ctx) {
  if (!exists(ctx.receipt)) return null;
  const stat = fs.lstatSync(ctx.receipt);
  if (!stat.isFile() || stat.isSymbolicLink()) refuse('INVALID_WORKSPACE_RECEIPT');
  const receipt = JSON.parse(fs.readFileSync(ctx.receipt, 'utf8'));
  if (receipt.schema !== SCHEMA || receipt.source !== ctx.source || receipt.sourceGitDir !== ctx.sourceGitDir
    || receipt.path !== ctx.path || receipt.task !== ctx.task || receipt.uid !== ctx.uid
    || !['worktree', 'scratch'].includes(receipt.kind) || !Number.isSafeInteger(receipt.ownerPid)
    || receipt.ownerPid < 2 || !Array.isArray(receipt.regenerable)) refuse('WORKSPACE_IDENTITY_COLLISION');
  regenerablePaths(receipt.regenerable);
  return receipt;
}
function withLock(ctx, action) {
  directory(path.dirname(ctx.base), true);
  directory(ctx.base, true);
  try { fs.mkdirSync(ctx.lock, { mode: 0o700 }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Serialize stale-lock recovery too: two callers must never remove a new
    // lock that the other caller just acquired in place of the dead owner's.
    const recovery = `${ctx.lock}.recovery`;
    let fd;
    try { fd = fs.openSync(recovery, 'wx', 0o600); } catch (recoveryError) {
      if (recoveryError.code === 'EEXIST') refuse('WORKSPACE_BUSY');
      throw recoveryError;
    }
    try {
      directory(ctx.lock);
      const ownerFile = path.join(ctx.lock, 'owner.json');
      if (!exists(ownerFile)) refuse('WORKSPACE_LOCK_OWNER_MISSING: inspect running writers and preserve the workspace before recovering this lock');
      const ownerStat = fs.lstatSync(ownerFile);
      if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) refuse('INVALID_WORKSPACE_LOCK');
      const owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
      if (owner.schema !== SCHEMA || !Number.isSafeInteger(owner.pid) || owner.pid < 2) refuse('INVALID_WORKSPACE_LOCK');
      if (alive(owner.pid)) refuse('WORKSPACE_BUSY');
      fs.rmSync(ctx.lock, { recursive: true });
      fs.mkdirSync(ctx.lock, { mode: 0o700 });
    } finally { fs.closeSync(fd); fs.rmSync(recovery, { force: true }); }
  }
  const token = randomUUID();
  try {
    json(path.join(ctx.lock, 'owner.json'), { schema: SCHEMA, pid: process.pid, token });
    return action();
  } finally {
    const file = path.join(ctx.lock, 'owner.json');
    if (exists(file) && JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.rmSync(ctx.lock, { recursive: true });
  }
}
function assertOwner(ctx, receipt) {
  if (receipt.ownerPid !== ctx.ownerPid && alive(receipt.ownerPid)) refuse('WORKSPACE_BUSY');
}
function assertWorktree(ctx, receipt) {
  assertDirectoryIdentity(ctx, receipt);
  if (!fs.lstatSync(path.join(ctx.path, '.git')).isFile()
    || fs.realpathSync(git(ctx.path, ['rev-parse', '--path-format=absolute', '--git-common-dir'])) !== ctx.sourceGitDir) refuse('WORKSPACE_IDENTITY_COLLISION');
  if (git(ctx.path, ['ls-files', '-v', '-z']).split('\0').some((entry) => /^[a-zS] /.test(entry))) refuse('WORKSPACE_INDEX_FLAGS');
  if (git(ctx.path, ['rev-parse', 'HEAD']) !== receipt.revision) refuse('WORKSPACE_HEAD_CHANGED');
  if (git(ctx.path, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'])) refuse('WORKSPACE_HAS_WIP');
}
function prepare(options, kind = 'worktree') {
  const ctx = context(options);
  if (!alive(ctx.ownerPid)) refuse('WORKSPACE_OWNER_NOT_RUNNING');
  const revision = git(ctx.source, ['rev-parse', '--verify', '--end-of-options', `${options.ref ?? 'HEAD'}^{commit}`]);
  const declared = regenerablePaths(options.regenerable ?? []);
  return withLock(ctx, () => {
    const prior = readReceipt(ctx);
    // A released task starts over: only a live workspace keeps its declarations.
    const active = prior && prior.state !== 'released';
    if (prior) {
      assertOwner(ctx, prior);
      if (prior.kind !== kind || (active && prior.revision !== revision)) refuse('WORKSPACE_IDENTITY_COLLISION');
      if (prior.state === 'retained') refuse('WORKSPACE_RETAINED_FOR_INSPECTION');
      if (active && declared.length && JSON.stringify(declared) !== JSON.stringify(prior.regenerable)) refuse('WORKSPACE_REGENERABLE_COLLISION');
    }
    const present = exists(ctx.path);
    if (present && (!prior || prior.state === 'released')) refuse('WORKSPACE_PATH_COLLISION');
    if (present) {
      if (kind === 'worktree') assertWorktree(ctx, prior);
      else assertDirectoryIdentity(ctx, prior);
    } else if (prior && prior.state === 'ready') refuse('WORKSPACE_MISSING');
    const receipt = { ...(prior ?? {}), schema: SCHEMA, uid: ctx.uid, source: ctx.source,
      sourceGitDir: ctx.sourceGitDir, task: ctx.task, path: ctx.path, kind, revision,
      regenerable: active ? prior.regenerable : declared, ownerPid: ctx.ownerPid,
      createdAt: prior?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), state: 'preparing' };
    json(ctx.receipt, receipt);
    try {
      if (!present) {
        if (kind === 'worktree') git(ctx.source, ['worktree', 'add', '--detach', ctx.path, revision]);
        else fs.mkdirSync(ctx.path, { mode: 0o700 });
        receipt.directoryIdentity = directoryIdentity(ctx.path);
      }
      receipt.state = 'ready';
      json(ctx.receipt, receipt);
      return { ...receipt, receipt: ctx.receipt, reused: present, cachePolicy: 'inherit existing package-manager caches; keep node_modules isolated' };
    } catch (error) {
      receipt.state = 'failed';
      json(ctx.receipt, receipt);
      throw error;
    }
  });
}
function release(options, retain = false) {
  const ctx = context(options);
  return withLock(ctx, () => {
    const receipt = readReceipt(ctx);
    if (!receipt) refuse('WORKSPACE_NOT_MANAGED');
    assertOwner(ctx, receipt);
    if (receipt.state === 'released' && !exists(ctx.path)) return { ...receipt, released: true, reused: true };
    assertDirectoryIdentity(ctx, receipt);
    if (retain) {
      receipt.state = 'retained';
    } else {
      if (receipt.kind === 'worktree') assertWorktree(ctx, receipt);
      else directory(ctx.path);
      const candidates = receipt.kind === 'worktree'
        ? git(ctx.path, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean)
        : scratchEntries(ctx.path, receipt.regenerable);
      const unknown = candidates.filter((file) => !covered(file, receipt.regenerable));
      if (unknown.length) refuse(`WORKSPACE_HAS_PRESERVED_FILES: ${unknown.length} undeclared path(s)`);
      assertDirectoryIdentity(ctx, receipt);
      if (receipt.kind === 'worktree') git(ctx.source, ['worktree', 'remove', '--force', ctx.path]);
      else fs.rmSync(ctx.path, { recursive: true });
      receipt.state = 'released';
    }
    receipt.updatedAt = new Date().toISOString();
    json(ctx.receipt, receipt);
    return { ...receipt, receipt: ctx.receipt, released: !retain };
  });
}
function status(options) {
  const ctx = context(options);
  return readReceipt(ctx) ?? { path: ctx.path, state: 'absent' };
}
module.exports = { prepare, release, status };
