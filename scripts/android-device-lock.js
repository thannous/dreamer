#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const LOCK_OWNERS = Object.freeze(['dreamer', 'lucid', 'meditation']);
const PRODUCT_METRO_PORTS = Object.freeze({
  dreamer: 8081,
  lucid: 8082,
  meditation: 8083,
});
const FINGERPRINT_SCHEME = 'adb-shell-secure-android-id-sha256-v1';
const DEFAULT_TTL_MS = 45 * 60 * 1000;
const EMULATOR_SERIAL = /^emulator-\d+$/i;
const ANDROID_ID_PATTERN = /^[0-9a-f]{8,32}$/i;

function parseLockOwner(value, label = '--lock-owner') {
  const owner = String(value || '').trim();
  if (!LOCK_OWNERS.includes(owner)) {
    throw new Error(`${label} must be one of: ${LOCK_OWNERS.join(', ')}.`);
  }
  return owner;
}

function inferLockOwnerFromSuite(suite) {
  return String(suite || '') === 'lucid' ? 'lucid' : 'dreamer';
}

function defaultMetroPortForOwner(owner) {
  return PRODUCT_METRO_PORTS[parseLockOwner(owner, 'owner')];
}

function isEmulatorSerial(serial) {
  return EMULATOR_SERIAL.test(String(serial || ''));
}

function resolveLockUserId() {
  if (typeof process.getuid === 'function') {
    try {
      return String(process.getuid());
    } catch {
      // Fall through to env-based identity on platforms without a uid.
    }
  }
  return String(process.env.USER || process.env.USERNAME || 'user');
}

function defaultHostLockDirectory(tmpdir = os.tmpdir()) {
  return path.join(tmpdir, `noctalia-android-device-locks-${resolveLockUserId()}`);
}

function resolveLockDirectory(env = process.env, _rootDir = null) {
  const override = String(env.NOCTALIA_ANDROID_DEVICE_LOCK_DIR || '').trim();
  if (override) {
    return path.resolve(override);
  }
  return defaultHostLockDirectory();
}

function resolveTtlMs(env = process.env, ttlMs = null) {
  if (Number.isInteger(ttlMs) && ttlMs > 0) {
    return ttlMs;
  }
  const fromEnv = Number.parseInt(String(env.NOCTALIA_ANDROID_DEVICE_LOCK_TTL_MS || ''), 10);
  if (Number.isInteger(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_TTL_MS;
}

function parseAndroidId(output) {
  const value = String(output || '').trim().toLowerCase();
  if (!ANDROID_ID_PATTERN.test(value)) {
    throw new Error(
      'Unable to obtain a stable Android device fingerprint from settings secure android_id.'
    );
  }
  return value;
}

function buildDeviceFingerprint(androidId) {
  const digest = crypto
    .createHash('sha256')
    .update(`${FINGERPRINT_SCHEME}\0${parseAndroidId(androidId)}`, 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

function fingerprintFileName(fingerprint) {
  const digest = String(fingerprint || '').replace(/^sha256:/, '');
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error('Invalid Android device fingerprint.');
  }
  return digest;
}

function lockPathForFingerprint(fingerprint, lockDir) {
  return path.join(lockDir, fingerprintFileName(fingerprint));
}

function createLockToken(randomBytes = crypto.randomBytes) {
  return randomBytes(16).toString('hex');
}

function readLockFile(lockPath, { readFileSync = fs.readFileSync } = {}) {
  let raw;
  try {
    raw = readFileSync(lockPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new Error(
      `[android-device-lock] REFUSED - lock file is unreadable at ${lockPath}. Leaving it in place.`
    );
  }
}

function isLockStale(lock, nowMs) {
  const expiresAt = Date.parse(lock?.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return nowMs >= expiresAt;
}

function formatLockDiagnostic(lock, {
  stale = false,
  lockPath = null,
  next = null,
} = {}) {
  const lines = [
    `[android-device-lock] REFUSED - locked by ${lock?.owner || 'unknown'} pid=${lock?.pid ?? 'unknown'} until=${lock?.expiresAt || 'unknown'}`,
    `  fingerprint: ${lock?.fingerprint || 'unknown'}`,
    `  transport: ${lock?.serial || 'unknown'} (informational; Wi-Fi host:port can change)`,
    `  command: ${lock?.command || 'unknown'}`,
    `  stale: ${stale ? 'yes' : 'no'}`,
  ];
  if (lockPath) {
    lines.push(`  lock: ${lockPath}`);
  }
  lines.push(
    `  next: ${next || (
      stale
        ? 'Pass --steal-lock only if this lock is stale and no owner is still using the phone.'
        : 'Wait for the owner to finish. Do not kill adb or disconnect the phone.'
    )}`
  );
  return lines.join('\n');
}

function fingerprintDevice(serial, {
  spawn = spawnSync,
  adbCommand = process.env.ADB_BIN || 'adb',
} = {}) {
  if (!serial) {
    throw new Error('A device serial is required to fingerprint the Android phone.');
  }
  if (isEmulatorSerial(serial)) {
    throw new Error(`Refusing to fingerprint emulator serial ${serial} as a physical device.`);
  }

  const result = spawn(adbCommand, ['-s', serial, 'shell', 'settings', 'get', 'secure', 'android_id'], {
    encoding: 'utf8',
  });
  if (result?.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Unable to read android_id from ${serial}: ${result.stderr || result.stdout || `exit ${result.status}`}`
    );
  }

  const androidId = parseAndroidId(result.stdout);
  return {
    serial,
    androidId,
    fingerprint: buildDeviceFingerprint(androidId),
  };
}

function createLockPayload({
  owner,
  serial,
  fingerprint,
  command,
  metroPort,
  ttlMs,
  nowMs,
  pid,
  token,
}) {
  const createdAt = new Date(nowMs).toISOString();
  return {
    version: 1,
    owner: parseLockOwner(owner, 'owner'),
    pid,
    token,
    createdAt,
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
    ttlMs,
    serial,
    fingerprint,
    command: command || null,
    metroPort: metroPort ?? defaultMetroPortForOwner(owner),
  };
}

function serializeLockPayload(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function createLockExclusively(lockPath, payload, {
  openSync = fs.openSync,
  closeSync = fs.closeSync,
  writeFileSync = fs.writeFileSync,
} = {}) {
  let fd;
  try {
    fd = openSync(lockPath, 'wx');
    writeFileSync(fd, serializeLockPayload(payload));
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return false;
    }
    throw error;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function refuseExistingLock(lockPath, existing, { stale = false, next = null } = {}) {
  throw new Error(formatLockDiagnostic(existing, { stale, lockPath, next }));
}

function guardPathForLock(lockPath) {
  return `${lockPath}.guard`;
}

function ensureLockDirectory(dir, {
  mkdirSync = fs.mkdirSync,
  chmodSync = fs.chmodSync,
} = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    if (typeof chmodSync === 'function') {
      chmodSync(dir, 0o700);
    }
  } catch {
    // Windows and some filesystems ignore POSIX modes.
  }
}

function withLockGuard(lockPath, io, fn) {
  const {
    openSync = fs.openSync,
    closeSync = fs.closeSync,
    unlinkSync = fs.unlinkSync,
  } = io;
  const guardPath = guardPathForLock(lockPath);
  let fd;
  try {
    fd = openSync(guardPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `[android-device-lock] REFUSED - another lock operation is in progress. The lock file was not touched.`
      );
    }
    throw error;
  }
  try {
    return fn();
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
    try {
      unlinkSync(guardPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

function acquireDeviceLock({
  owner,
  serial,
  fingerprint = null,
  stealLock = false,
  command = null,
  metroPort = null,
  ttlMs = null,
  nowMs = Date.now(),
  pid = process.pid,
  token = null,
  lockDir,
  env = process.env,
  spawn = spawnSync,
  adbCommand = env.ADB_BIN || 'adb',
  mkdirSync = fs.mkdirSync,
  chmodSync = fs.chmodSync,
  openSync = fs.openSync,
  closeSync = fs.closeSync,
  writeFileSync = fs.writeFileSync,
  readFileSync = fs.readFileSync,
  unlinkSync = fs.unlinkSync,
  randomBytes = crypto.randomBytes,
} = {}) {
  const resolvedOwner = parseLockOwner(owner, 'owner');
  const resolvedFingerprint = fingerprint || fingerprintDevice(serial, { spawn, adbCommand }).fingerprint;
  const resolvedDir = lockDir || resolveLockDirectory(env);
  const resolvedTtl = resolveTtlMs(env, ttlMs);
  const resolvedToken = token || createLockToken(randomBytes);
  const lockPath = lockPathForFingerprint(resolvedFingerprint, resolvedDir);
  const payload = createLockPayload({
    owner: resolvedOwner,
    serial,
    fingerprint: resolvedFingerprint,
    command,
    metroPort,
    ttlMs: resolvedTtl,
    nowMs,
    pid,
    token: resolvedToken,
  });

  ensureLockDirectory(resolvedDir, { mkdirSync, chmodSync });

  const io = { openSync, closeSync, writeFileSync };

  return withLockGuard(lockPath, { openSync, closeSync, unlinkSync }, () => {
    const current = readLockFile(lockPath, { readFileSync });
    if (!current) {
      if (createLockExclusively(lockPath, payload, io)) {
        return { ...payload, lockPath, stolen: false };
      }
      const raced = readLockFile(lockPath, { readFileSync });
      refuseExistingLock(lockPath, raced, {
        stale: isLockStale(raced, nowMs),
        next: 'A new owner acquired the lock while this operation ran. The live file was left in place.',
      });
    }
    if (!isLockStale(current, nowMs)) {
      refuseExistingLock(lockPath, current, { stale: false });
    }
    if (!stealLock) {
      refuseExistingLock(lockPath, current, {
        stale: true,
        next: 'The lock is stale. Pass --steal-lock only after confirming no owner is still using the phone. The stale file is left in place.',
      });
    }

    const latest = readLockFile(lockPath, { readFileSync });
    if (!latest) {
      if (createLockExclusively(lockPath, payload, io)) {
        return { ...payload, lockPath, stolen: true };
      }
      const raced = readLockFile(lockPath, { readFileSync });
      refuseExistingLock(lockPath, raced, {
        stale: isLockStale(raced, nowMs),
        next: 'A new owner acquired the lock during --steal-lock. The live file was left in place.',
      });
    }
    if (!isLockStale(latest, nowMs)) {
      refuseExistingLock(lockPath, latest, {
        stale: false,
        next: 'A new owner acquired the lock during --steal-lock. The live file was left in place.',
      });
    }

    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    if (createLockExclusively(lockPath, payload, io)) {
      return { ...payload, lockPath, stolen: true, previousOwner: latest.owner };
    }
    const raced = readLockFile(lockPath, { readFileSync });
    refuseExistingLock(lockPath, raced, {
      stale: isLockStale(raced, nowMs),
      next: 'A new owner acquired the lock during --steal-lock. The live file was left in place.',
    });
  });
}

function releaseDeviceLock({
  lockPath,
  token,
  readFileSync = fs.readFileSync,
  unlinkSync = fs.unlinkSync,
  openSync = fs.openSync,
  closeSync = fs.closeSync,
} = {}) {
  if (!lockPath || !token) {
    throw new Error('releaseDeviceLock requires lockPath and the owner token.');
  }

  return withLockGuard(lockPath, { openSync, closeSync, unlinkSync }, () => {
    const existing = readLockFile(lockPath, { readFileSync });
    if (!existing) {
      return { released: false, reason: 'missing' };
    }
    if (existing.token !== token) {
      throw new Error(
        formatLockDiagnostic(existing, {
          stale: isLockStale(existing, Date.now()),
          lockPath,
          next: 'Refusing to release a lock with a mismatched token. The file was left in place.',
        })
      );
    }

    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { released: false, reason: 'missing' };
      }
      throw error;
    }
    return { released: true, lockPath };
  });
}

function releaseDeviceLocks(locks, io = {}) {
  const errors = [];
  for (const lock of locks || []) {
    try {
      releaseDeviceLock({ ...lock, ...io });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new Error(errors.map((error) => error.message).join('\n'));
  }
}

function attachDeviceLockSignals(locks, {
  io = {},
  onSignal = null,
} = {}) {
  let released = false;
  const releaseOnce = () => {
    if (released) {
      return { released: false, reason: 'already' };
    }
    released = true;
    releaseDeviceLocks(locks, io);
    return { released: true };
  };
  const handle = (exitCode) => {
    try {
      releaseOnce();
    } finally {
      if (onSignal) {
        onSignal(exitCode);
      } else {
        process.exit(exitCode);
      }
    }
  };
  process.once('SIGINT', () => handle(130));
  process.once('SIGTERM', () => handle(143));
  return releaseOnce;
}

function assertPhysicalDevicesHaveExplicitSerial(devices, explicitDevices) {
  const physical = (devices || []).filter((serial) => !isEmulatorSerial(serial));
  if (physical.length > 0 && !explicitDevices) {
    throw new Error(
      'Physical Android QA requires an explicit --device <serial>. ' +
        `Ready physical transport(s): ${physical.join(', ')}.`
    );
  }
  return physical;
}

function prepareAndroidDeviceLocks({
  devices = [],
  owner,
  stealLock = false,
  explicitDevices = false,
  command = null,
  metroPort = null,
  ttlMs = null,
  nowMs = Date.now(),
  pid = process.pid,
  lockDir,
  env = process.env,
  spawn = spawnSync,
  adbCommand = env.ADB_BIN || 'adb',
  io = {},
} = {}) {
  const physical = assertPhysicalDevicesHaveExplicitSerial(devices, explicitDevices);
  if (physical.length === 0) {
    return { locks: [], skipped: 'emulator-only' };
  }

  const unique = new Map();
  for (const serial of physical) {
    const identity = fingerprintDevice(serial, { spawn, adbCommand });
    const current = unique.get(identity.fingerprint);
    if (current) {
      current.serials.push(serial);
      continue;
    }
    unique.set(identity.fingerprint, {
      fingerprint: identity.fingerprint,
      serials: [serial],
    });
  }

  const locks = [];
  try {
    for (const entry of unique.values()) {
      locks.push(acquireDeviceLock({
        owner,
        serial: entry.serials[0],
        fingerprint: entry.fingerprint,
        stealLock,
        command,
        metroPort,
        ttlMs,
        nowMs,
        pid,
        lockDir,
        env,
        spawn,
        adbCommand,
        ...io,
      }));
    }
  } catch (error) {
    releaseDeviceLocks(locks, io);
    throw error;
  }

  return { locks, skipped: null };
}

function findDeviceArg(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--device') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --device');
      }
      return value;
    }
    if (argv[index].startsWith('--device=')) {
      const value = argv[index].slice('--device='.length);
      if (!value) {
        throw new Error('Missing value for --device');
      }
      return value;
    }
  }
  return null;
}

function listReadyAdbSerials({
  spawn = spawnSync,
  adbCommand = process.env.ADB_BIN || 'adb',
} = {}) {
  const result = spawn(adbCommand, ['devices'], { encoding: 'utf8' });
  if (result?.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to list adb devices');
  }
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);
}

function parseWrapArgs(argv) {
  const options = {
    owner: null,
    device: null,
    stealLock: false,
    ttlMs: null,
  };
  const command = [];
  let seenSeparator = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (seenSeparator) {
      command.push(arg);
      continue;
    }
    if (arg === '--') {
      seenSeparator = true;
      continue;
    }
    if (arg === '--owner' || arg === '--lock-owner') {
      options.owner = parseLockOwner(argv[index + 1], arg);
      index += 1;
      continue;
    }
    if (arg === '--device') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --device');
      }
      options.device = value;
      index += 1;
      continue;
    }
    if (arg === '--steal-lock') {
      options.stealLock = true;
      continue;
    }
    if (arg === '--ttl-ms') {
      options.ttlMs = Number.parseInt(argv[index + 1] ?? '', 10);
      if (!Number.isInteger(options.ttlMs) || options.ttlMs <= 0) {
        throw new Error('Invalid --ttl-ms value');
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown android-device-lock argument: ${arg}`);
  }

  if (!options.owner) {
    throw new Error('wrap requires --owner dreamer|lucid|meditation');
  }
  if (!command.length) {
    throw new Error('wrap requires a command after --');
  }
  return { options, command };
}

function wrapWithDeviceLock(argv = process.argv.slice(2), {
  env = process.env,
  spawn = spawnSync,
  spawnCommand = spawnSync,
  lockDir,
  nowMs = Date.now(),
  pid = process.pid,
  io = {},
  attachSignals = false,
} = {}) {
  const { options, command } = parseWrapArgs(argv);
  const requestedDevice = options.device || findDeviceArg(command) || env.ANDROID_SERIAL || null;
  const listed = requestedDevice
    ? [requestedDevice]
    : listReadyAdbSerials({ spawn, adbCommand: env.ADB_BIN || 'adb' });
  const prepared = prepareAndroidDeviceLocks({
    devices: listed,
    owner: options.owner,
    stealLock: options.stealLock,
    explicitDevices: Boolean(requestedDevice),
    command: command.join(' '),
    metroPort: defaultMetroPortForOwner(options.owner),
    ttlMs: options.ttlMs,
    nowMs,
    pid,
    lockDir,
    env,
    spawn,
    io,
  });

  const childEnv = { ...env };
  if (requestedDevice) {
    childEnv.ANDROID_SERIAL = requestedDevice;
  }

  const releaseOnce = attachSignals
    ? attachDeviceLockSignals(prepared.locks, { io })
    : () => releaseDeviceLocks(prepared.locks, io);

  try {
    const result = spawnCommand(command[0], command.slice(1), {
      stdio: 'inherit',
      env: childEnv,
    });
    if (result?.error) {
      throw result.error;
    }
    return {
      status: result.status,
      locks: prepared.locks,
      skipped: prepared.skipped,
    };
  } finally {
    releaseOnce();
  }
}

function printHelp() {
  process.stdout.write(`
Reserve one physical Android phone for a single Noctalia owner.

Usage:
  node ./scripts/android-device-lock.js wrap --owner dreamer|lucid|meditation [--device <serial>] [--steal-lock] -- <command>

The lock key is sha256(android_id), not the ADB host:port. Emulators are skipped.
A live or stale lock is never deleted automatically. --steal-lock replaces a stale
lock only after a diagnostic. Release requires the owner token.
`.trimStart());
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === 'wrap') {
    const result = wrapWithDeviceLock(argv.slice(1), { attachSignals: true });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (argv[0] === '--help' || argv[0] === '-h' || argv.length === 0) {
    printHelp();
    return;
  }
  throw new Error('Usage: node ./scripts/android-device-lock.js wrap --owner <owner> -- <command>');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_TTL_MS,
  FINGERPRINT_SCHEME,
  LOCK_OWNERS,
  PRODUCT_METRO_PORTS,
  acquireDeviceLock,
  attachDeviceLockSignals,
  assertPhysicalDevicesHaveExplicitSerial,
  buildDeviceFingerprint,
  createLockToken,
  defaultMetroPortForOwner,
  findDeviceArg,
  fingerprintDevice,
  formatLockDiagnostic,
  inferLockOwnerFromSuite,
  isEmulatorSerial,
  isLockStale,
  listReadyAdbSerials,
  lockPathForFingerprint,
  parseAndroidId,
  parseLockOwner,
  parseWrapArgs,
  prepareAndroidDeviceLocks,
  readLockFile,
  releaseDeviceLock,
  releaseDeviceLocks,
  resolveLockDirectory,
  wrapWithDeviceLock,
};
