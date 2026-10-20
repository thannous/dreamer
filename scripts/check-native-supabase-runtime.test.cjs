'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SUPPORTED_HINT, nativeRuntimeProblems } = require('./check-native-supabase-runtime.cjs');

const linux = { platform: 'linux', arch: 'x64', glibc: '2.41', uid: 1000, cliVersion: '2.121.0\n' };
const mac = { platform: 'darwin', arch: 'arm64', darwinRelease: '23.6.0', uid: 501, cliVersion: '2.121.0' };

test('supported Linux and Apple silicon hosts with the pinned CLI can run the native stack', () => {
  assert.deepEqual(nativeRuntimeProblems(linux), []);
  assert.deepEqual(nativeRuntimeProblems({ ...linux, arch: 'arm64', glibc: '2.35' }), []);
  assert.deepEqual(nativeRuntimeProblems(mac), []);
  assert.deepEqual(nativeRuntimeProblems({ ...linux, uid: 0, postgresUser: 'postgres' }), []);
});

// Every case here must leave e2e-backend unavailable, never let it pass without running.
for (const [name, host] of [
  ['Windows', { ...linux, platform: 'win32', glibc: undefined }],
  ['Intel macOS', { ...mac, arch: 'x64' }],
  ['macOS 13', { ...mac, darwinRelease: '22.6.0' }],
  ['glibc 2.34', { ...linux, glibc: '2.34' }],
  ['musl Linux', { ...linux, glibc: undefined }],
  ['32-bit Linux', { ...linux, arch: 'ia32' }],
  ['root without a Postgres user', { ...linux, uid: 0 }],
  ['CLI 2.118', { ...linux, cliVersion: '2.118.9' }],
  ['missing CLI', { ...linux, cliVersion: null }],
]) test(`${name} is refused by the native runtime probe`, () => {
  assert.ok(nativeRuntimeProblems(host).length > 0);
});

test('the probe exits non-zero when the CLI cannot run, so the check stays unavailable', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'check-native-supabase-runtime.cjs')], {
    encoding: 'utf8', env: { ...process.env, E2E_SUPABASE_CLI: path.join(__dirname, 'no-such-supabase-cli') },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Native Supabase runtime unavailable/);
  assert.ok(result.stderr.includes('needs Linux glibc>=2.35 (WSL2 on Windows) or macOS 14+ Apple silicon'), result.stderr);
  assert.equal(SUPPORTED_HINT, 'needs Linux glibc>=2.35 (WSL2 on Windows) or macOS 14+ Apple silicon');
});
