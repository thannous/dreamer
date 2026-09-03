'use strict';
/* global describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  PRODUCT_METRO_PORTS,
  acquireDeviceLock,
  assertPhysicalDevicesHaveExplicitSerial,
  buildDeviceFingerprint,
  defaultMetroPortForOwner,
  findDeviceArg,
  fingerprintDevice,
  inferLockOwnerFromSuite,
  isEmulatorSerial,
  parseAndroidId,
  parseLockOwner,
  parseWrapArgs,
  prepareAndroidDeviceLocks,
  readLockFile,
  releaseDeviceLock,
  resolveLockDirectory,
  wrapWithDeviceLock,
} = require('./android-device-lock');

const ANDROID_ID = '0123456789abcdef';
const FINGERPRINT = buildDeviceFingerprint(ANDROID_ID);

function makeLockDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-android-lock-'));
}

function spawnAndroidId(serials = {}) {
  return (command, args) => {
    if (command === 'adb' && args[0] === '-s' && args[2] === 'shell') {
      const serial = args[1];
      const androidId = serials[serial] ?? ANDROID_ID;
      return { status: 0, stdout: `${androidId}\n`, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected adb call' };
  };
}

describe('android-device-lock', () => {
  it('hashes android_id and treats host:port as informational only', () => {
    const wifi = fingerprintDevice('192.168.1.176:40537', {
      spawn: spawnAndroidId(),
      adbCommand: 'adb',
    });
    const usb = fingerprintDevice('ZY22LJM555', {
      spawn: spawnAndroidId(),
      adbCommand: 'adb',
    });
    expect(wifi.fingerprint).toBe(FINGERPRINT);
    expect(usb.fingerprint).toBe(FINGERPRINT);
    expect(wifi.serial).toBe('192.168.1.176:40537');
    expect(usb.serial).toBe('ZY22LJM555');
    expect(parseAndroidId(' 0123456789ABCDEF \n')).toBe(ANDROID_ID);
  });

  it('shares one host-global lock directory across worktrees', () => {
    const dreamerTree = resolveLockDirectory({}, '/private/tmp/dreamer-vnext-ti-412-rebased');
    const meditationTree = resolveLockDirectory({}, '/Users/tanuki/Documents/dreamer');
    const uid = typeof process.getuid === 'function' ? String(process.getuid()) : 'user';
    expect(dreamerTree).toBe(meditationTree);
    expect(dreamerTree).toBe(path.join(os.tmpdir(), `noctalia-android-device-locks-${uid}`));
    expect(dreamerTree).not.toContain(`${path.sep}.tmp${path.sep}`);
    expect(resolveLockDirectory(
      { NOCTALIA_ANDROID_DEVICE_LOCK_DIR: '/tmp/injected-noctalia-locks' },
      '/private/tmp/other-worktree'
    )).toBe(path.resolve('/tmp/injected-noctalia-locks'));
  });

  it('acquires atomically and refuses a second live owner without deleting the file', () => {
    const lockDir = makeLockDir();
    const first = acquireDeviceLock({
      owner: 'dreamer',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      lockDir,
      nowMs: 1_700_000_000_000,
      pid: 111,
      token: 'token-dreamer',
      command: 'npm run test:e2e:release:ti429:local',
    });
    expect(first.owner).toBe('dreamer');
    expect(first.stolen).toBe(false);
    expect(fs.existsSync(first.lockPath)).toBe(true);

    expect(() => acquireDeviceLock({
      owner: 'meditation',
      serial: '192.168.1.176:38685',
      fingerprint: FINGERPRINT,
      lockDir,
      nowMs: 1_700_000_000_500,
      pid: 222,
      token: 'token-meditation',
    })).toThrow(/locked by dreamer pid=111/);

    const leftover = readLockFile(first.lockPath);
    expect(leftover.token).toBe('token-dreamer');
    expect(leftover.owner).toBe('dreamer');
    expect(leftover.serial).toBe('192.168.1.176:40537');
  });

  it('refuses a concurrent acquire while a guard is held without touching the lock', () => {
    const lockDir = makeLockDir();
    const first = acquireDeviceLock({
      owner: 'dreamer',
      serial: 'ZY22LJM555',
      fingerprint: FINGERPRINT,
      lockDir,
      pid: 111,
      token: 'token-dreamer',
    });
    fs.writeFileSync(`${first.lockPath}.guard`, '');
    expect(() => acquireDeviceLock({
      owner: 'meditation',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      lockDir,
      pid: 222,
      token: 'token-meditation',
    })).toThrow(/another lock operation is in progress[\s\S]*not touched/);
    expect(readLockFile(first.lockPath).token).toBe('token-dreamer');
    fs.unlinkSync(`${first.lockPath}.guard`);
  });

  it('reports a stale lock without stealing it until --steal-lock is explicit', () => {
    const lockDir = makeLockDir();
    const created = acquireDeviceLock({
      owner: 'lucid',
      serial: 'ZY22LJM555',
      fingerprint: FINGERPRINT,
      lockDir,
      nowMs: 1_700_000_000_000,
      ttlMs: 1000,
      pid: 333,
      token: 'stale-token',
    });

    expect(() => acquireDeviceLock({
      owner: 'dreamer',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      lockDir,
      nowMs: 1_700_000_002_000,
      pid: 444,
    })).toThrow(/stale: yes[\s\S]*The stale file is left in place/);
    expect(readLockFile(created.lockPath).token).toBe('stale-token');

    const stolen = acquireDeviceLock({
      owner: 'dreamer',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      stealLock: true,
      lockDir,
      nowMs: 1_700_000_002_000,
      pid: 444,
      token: 'new-token',
    });
    expect(stolen.stolen).toBe(true);
    expect(stolen.previousOwner).toBe('lucid');
    expect(readLockFile(created.lockPath).token).toBe('new-token');
  });

  it('refuses --steal-lock with wx when a live owner appears after the stale file vanishes', () => {
    const lockDir = makeLockDir();
    const lockPath = path.join(lockDir, FINGERPRINT.replace(/^sha256:/, ''));
    const guardPath = `${lockPath}.guard`;
    const nowMs = 5_000;
    const stale = {
      owner: 'lucid',
      pid: 1,
      token: 'stale-token',
      expiresAt: new Date(2_000).toISOString(),
      fingerprint: FINGERPRINT,
      serial: '192.168.1.176:40537',
      command: 'old-owner',
    };
    const live = {
      owner: 'meditation',
      pid: 9,
      token: 'live-token',
      expiresAt: new Date(99_000).toISOString(),
      fingerprint: FINGERPRINT,
      serial: 'ZY22LJM555',
      command: 'meditation e2e',
    };
    const reads = [];
    const opens = [];
    const writes = [];

    expect(() => acquireDeviceLock({
      owner: 'dreamer',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      stealLock: true,
      lockDir,
      nowMs,
      pid: 444,
      token: 'thief-token',
      mkdirSync() {},
      openSync(file, flags) {
        opens.push({ file, flags });
        if (flags === 'w' || flags === 'w+' || flags === 'a') {
          throw new Error(`unexpected truncating open ${flags} for ${file}`);
        }
        if (file === guardPath && flags === 'wx') {
          return 11;
        }
        if (file === lockPath && flags === 'wx') {
          const error = new Error('exists');
          error.code = 'EEXIST';
          throw error;
        }
        throw new Error(`unexpected open ${flags} ${file}`);
      },
      closeSync() {},
      unlinkSync(file) {
        if (file === lockPath) {
          throw new Error('must not unlink a live lock');
        }
      },
      readFileSync(file) {
        if (file !== lockPath) {
          throw new Error(`unexpected read ${file}`);
        }
        reads.push(file);
        if (reads.length === 1) {
          return JSON.stringify(stale);
        }
        if (reads.length === 2) {
          const error = new Error('missing');
          error.code = 'ENOENT';
          throw error;
        }
        return JSON.stringify(live);
      },
      writeFileSync(target, data) {
        writes.push({
          target: typeof target === 'number' ? `fd:${target}` : target,
          bytes: String(data || '').length,
        });
      },
    })).toThrow(/locked by meditation pid=9[\s\S]*live file was left in place/);

    expect(opens.filter((entry) => entry.flags === 'wx' && entry.file === lockPath)).toHaveLength(1);
    expect(opens.some((entry) => entry.flags === 'w')).toBe(false);
    expect(writes).toEqual([]);
    expect(reads).toHaveLength(3);
  });

  it('keeps a live token intact when stale is released and reacquired before steal unlink', () => {
    const lockDir = makeLockDir();
    const stale = acquireDeviceLock({
      owner: 'lucid',
      serial: 'ZY22LJM555',
      fingerprint: FINGERPRINT,
      lockDir,
      nowMs: 1_000,
      ttlMs: 100,
      pid: 1,
      token: 'stale-token',
    });
    const live = {
      owner: 'meditation',
      pid: 9,
      token: 'live-token',
      expiresAt: new Date(99_000).toISOString(),
      fingerprint: FINGERPRINT,
      serial: '192.168.1.176:40537',
      command: 'meditation e2e',
    };
    const lockReads = [];
    const unlinked = [];

    expect(() => acquireDeviceLock({
      owner: 'dreamer',
      serial: '192.168.1.176:40537',
      fingerprint: FINGERPRINT,
      stealLock: true,
      lockDir,
      nowMs: 5_000,
      pid: 444,
      token: 'thief-token',
      readFileSync(file, encoding) {
        if (file !== stale.lockPath) {
          return fs.readFileSync(file, encoding);
        }
        lockReads.push(file);
        if (lockReads.length === 1) {
          return JSON.stringify({
            owner: 'lucid',
            pid: 1,
            token: 'stale-token',
            expiresAt: new Date(1_100).toISOString(),
            fingerprint: FINGERPRINT,
            serial: 'ZY22LJM555',
            command: 'old-owner',
          });
        }
        fs.writeFileSync(stale.lockPath, `${JSON.stringify(live, null, 2)}\n`);
        return JSON.stringify(live);
      },
      unlinkSync(file) {
        unlinked.push(file);
        if (file === stale.lockPath) {
          throw new Error('must not unlink the live lock');
        }
        return fs.unlinkSync(file);
      },
    })).toThrow(/locked by meditation pid=9[\s\S]*live file was left in place/);

    expect(JSON.parse(fs.readFileSync(stale.lockPath, 'utf8')).token).toBe('live-token');
    expect(unlinked).not.toContain(stale.lockPath);
    expect(lockReads.length).toBeGreaterThanOrEqual(2);
  });

  it('creates the host lock directory as user-only 0700 when the platform allows it', () => {
    const lockDir = path.join(os.tmpdir(), `noctalia-lock-mode-${process.pid}`);
    const mkdirCalls = [];
    const chmodCalls = [];
    const result = acquireDeviceLock({
      owner: 'dreamer',
      serial: 'ZY22LJM555',
      fingerprint: FINGERPRINT,
      lockDir,
      token: 'mode-token',
      pid: 7,
      mkdirSync(dir, options) {
        mkdirCalls.push({ dir, options });
      },
      chmodSync(dir, mode) {
        chmodCalls.push({ dir, mode });
      },
      openSync() {
        return 4;
      },
      closeSync() {},
      unlinkSync() {},
      writeFileSync() {},
      readFileSync() {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
    });
    expect(result.stolen).toBe(false);
    expect(mkdirCalls[0]).toEqual({
      dir: lockDir,
      options: { recursive: true, mode: 0o700 },
    });
    expect(chmodCalls[0]).toEqual({ dir: lockDir, mode: 0o700 });
  });

  it('releases only with the owner token', () => {
    const lockDir = makeLockDir();
    const lock = acquireDeviceLock({
      owner: 'meditation',
      serial: 'ZY22LJM555',
      fingerprint: FINGERPRINT,
      lockDir,
      token: 'owner-token',
      pid: 555,
    });

    expect(() => releaseDeviceLock({
      lockPath: lock.lockPath,
      token: 'wrong-token',
    })).toThrow(/mismatched token/);
    expect(fs.existsSync(lock.lockPath)).toBe(true);

    expect(releaseDeviceLock({
      lockPath: lock.lockPath,
      token: 'owner-token',
    })).toEqual({ released: true, lockPath: lock.lockPath });
    expect(fs.existsSync(lock.lockPath)).toBe(false);
  });

  it('collapses two transports with the same android_id into one lock', () => {
    const lockDir = makeLockDir();
    const prepared = prepareAndroidDeviceLocks({
      devices: ['192.168.1.176:40537', 'ZY22LJM555'],
      owner: 'dreamer',
      explicitDevices: true,
      lockDir,
      spawn: spawnAndroidId(),
      adbCommand: 'adb',
      token: 'shared-token',
    });
    expect(prepared.locks).toHaveLength(1);
    expect(prepared.locks[0].fingerprint).toBe(FINGERPRINT);
    expect(prepared.skipped).toBeNull();
  });

  it('skips emulators and requires an explicit serial for a physical phone', () => {
    expect(isEmulatorSerial('emulator-5554')).toBe(true);
    expect(prepareAndroidDeviceLocks({
      devices: ['emulator-5554'],
      owner: 'dreamer',
      explicitDevices: false,
    })).toEqual({ locks: [], skipped: 'emulator-only' });

    expect(() => assertPhysicalDevicesHaveExplicitSerial(
      ['192.168.1.176:40537'],
      false
    )).toThrow('explicit --device');
    expect(assertPhysicalDevicesHaveExplicitSerial(
      ['192.168.1.176:40537'],
      true
    )).toEqual(['192.168.1.176:40537']);
  });

  it('keeps product Metro ports stable and infers owners from existing suites', () => {
    expect(PRODUCT_METRO_PORTS).toEqual({
      dreamer: 8081,
      lucid: 8082,
      meditation: 8083,
    });
    expect(defaultMetroPortForOwner('lucid')).toBe(8082);
    expect(inferLockOwnerFromSuite('lucid')).toBe('lucid');
    expect(inferLockOwnerFromSuite('release-ti429')).toBe('dreamer');
    expect(parseLockOwner('meditation')).toBe('meditation');
    expect(() => parseLockOwner('dream')).toThrow('must be one of');
  });

  it('wraps Meditation on the same lock and releases after the command', () => {
    const lockDir = makeLockDir();
    const env = { ADB_BIN: 'adb' };
    let seenLock = false;
    const result = wrapWithDeviceLock([
      '--owner',
      'meditation',
      '--device',
      '192.168.1.176:40537',
      '--',
      'maestro',
      'test',
      'maestro/smoke.yml',
    ], {
      env,
      lockDir,
      spawn: spawnAndroidId(),
      spawnCommand: (command, args, options) => {
        expect(command).toBe('maestro');
        expect(args).toEqual(['test', 'maestro/smoke.yml']);
        expect(options.env.ANDROID_SERIAL).toBe('192.168.1.176:40537');
        const files = fs.readdirSync(lockDir).filter((name) => !name.endsWith('.steal'));
        expect(files).toHaveLength(1);
        seenLock = true;
        return { status: 0, stdout: '', stderr: '' };
      },
    });
    expect(seenLock).toBe(true);
    expect(result.status).toBe(0);
    expect(fs.readdirSync(lockDir)).toEqual([]);
  });

  it('parses wrap arguments without inventing a second lock', () => {
    expect(parseWrapArgs([
      '--owner',
      'meditation',
      '--steal-lock',
      '--',
      'maestro',
      'test',
      'maestro/smoke.yml',
      '--device',
      'ZY22LJM555',
    ])).toEqual({
      options: {
        owner: 'meditation',
        device: null,
        stealLock: true,
        ttlMs: null,
      },
      command: ['maestro', 'test', 'maestro/smoke.yml', '--device', 'ZY22LJM555'],
    });
    expect(findDeviceArg(['maestro', 'test', '--device', 'ZY22LJM555'])).toBe('ZY22LJM555');
  });
});
