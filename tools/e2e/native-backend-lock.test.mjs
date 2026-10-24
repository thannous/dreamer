import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { acquireNativeBackendRunLock, releaseNativeBackendRunLock } from './native-backend-lock.mjs';

// A second device could delete the active journey's dreams/quota or reconnect
// its offline transport. Test the cross-process exclusion without corrupting a
// real running native journey just to exercise the guard.
const identity = { stackId: 'a'.repeat(64), product: 'dreamer', platform: 'ios', device: 'owned-ios' };
const helper = new URL('./native-backend-lock.mjs', import.meta.url).href;
function contender(directory) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { acquireNativeBackendRunLock, releaseNativeBackendRunLock } from ${JSON.stringify(helper)};
    try {
      const lock = acquireNativeBackendRunLock(${JSON.stringify({ ...identity, platform: 'android', device: 'emulator-5554' })}, ${JSON.stringify(directory)});
      releaseNativeBackendRunLock(lock);
    } catch (error) { process.exitCode = error.code === 'EEXIST' ? 73 : 74; }
  `], { encoding: 'utf8' });
}

test('the same stack excludes another device process until its owner releases it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'noctalia-backend-lock-test-'));
  try {
    const lock = acquireNativeBackendRunLock(identity, directory);
    const before = readFileSync(lock.path, 'utf8');
    const blocked = contender(directory);
    assert.ifError(blocked.error);
    assert.equal(blocked.status, 73, blocked.stderr);
    assert.equal(readFileSync(lock.path, 'utf8'), before);
    releaseNativeBackendRunLock(lock);
    assert.equal(existsSync(lock.path), false);
    const next = contender(directory);
    assert.ifError(next.error);
    assert.equal(next.status, 0, next.stderr);
    assert.equal(existsSync(lock.path), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('cleanup cannot remove a lock replaced by another invocation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'noctalia-backend-lock-test-'));
  try {
    const lock = acquireNativeBackendRunLock(identity, directory);
    const foreign = { ...lock.owner, invocation: 'another-invocation', device: 'other-owned-ios' };
    writeFileSync(lock.path, JSON.stringify(foreign));
    assert.throws(() => releaseNativeBackendRunLock(lock), /Foreign native backend lock/);
    assert.deepEqual(JSON.parse(readFileSync(lock.path, 'utf8')), foreign);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
