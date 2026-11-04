import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireSimlock, needsSimlock } from './simlock-native.mjs';

const driver = fileURLToPath(new URL('./simlock-driver.mjs', import.meta.url));
const fixture = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const record = value => fs.appendFileSync(process.env.FAKE_EVENTS, JSON.stringify(value) + '\\n');
// Simlock's precedence: a defined SIMLOCK_AGENT_ID wins, even when empty.
const requesterId = () => process.env.SIMLOCK_AGENT_ID !== undefined ? process.env.SIMLOCK_AGENT_ID
  : process.env.CLAUDE_CODE_SESSION_ID ? 'claude-code:' + process.env.CLAUDE_CODE_SESSION_ID : 'codex:' + process.env.CODEX_SESSION_ID;
record(process.env.FAKE_SDK_PROBE === '1' ? [...args, 'sdk=' + process.env.ANDROID_HOME + '|' + process.env.ANDROID_SDK_ROOT] : args);
if (args[0] === 'catalog') {
  if (process.env.FAKE_SLOW_CATALOG === '1') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
  process.stdout.write(JSON.stringify({ platforms: [{ platform: args[args.indexOf('--platform') + 1], runtimes: ['1'], modelRuntimes: { phone: ['1'] } }] }) + '\\n');
} else if (args[0] === 'lease') {
  if (process.env.FAKE_WAIT === '1') {
    // Like Simlock 0.4.0, a queued request outlives a signal: the late grant is
    // reported, then released by the terminating holder.
    const late = () => setTimeout(() => {
      record(['late-grant']);
      process.stdout.write(JSON.stringify({ lease: { id: 'lse_late', deviceId: 'dev_late', grantedAt: 1, requesterId: requesterId() },
        device: { id: 'dev_late', address: '12345678-1234-1234-1234-123456789abc', physical: false, spec: { platform: 'ios', model: 'phone', osVersion: '1', physical: false } },
        environment: {} }) + '\\n', () => process.exit(0));
    }, 300);
    process.once('SIGTERM', late);
    process.once('SIGINT', late);
    record(['ready']);
    setInterval(() => {}, 1000);
    return;
  }
  if (process.env.FAKE_DENY === '1') { process.stderr.write('capacity unavailable'); process.exit(11); }
  const platform = args[args.indexOf('--platform') + 1];
  const device = platform === 'ios' ? '12345678-1234-1234-1234-123456789abc' : 'emulator-5558';
  const requester = requesterId();
  const grant = { lease: { id: 'lse_ours', deviceId: 'dev_ours', grantedAt: 1, requesterId: process.env.FAKE_FOREIGN === '1' ? 'foreign' : requester },
    device: { id: 'dev_ours', address: device, physical: process.env.FAKE_PHYSICAL === '1',
      spec: { platform, model: 'phone', osVersion: '1', physical: false } },
    environment: platform === 'ios' ? (process.env.FAKE_NO_IOS_SET === '1' ? {} : { SIMLOCK_IOS_DEVICE_SET: '/private/qa-set' }) : { ANDROID_ADB_SERVER_PORT: '5042' } };
  process.stdout.write(JSON.stringify(grant) + '\\n');
  record(['holder', process.pid]);
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => { record(['holder-sigint']); process.exit(0); });
  if (process.env.FAKE_LOSS === '1') setTimeout(() => process.exit(14), Number(process.env.FAKE_LOSS_MS ?? 100));
  else setInterval(() => {}, 1000);
} else if (args[0] === 'release') {
  if (process.env.FAKE_FAIL_RELEASE === '1') { process.stderr.write('release rejected'); process.exit(3); }
  process.stdout.write(JSON.stringify({ leaseId: process.env.FAKE_WRONG_RELEASE === '1' ? 'foreign' : args[1] }) + '\\n');
} else if (args[0] === 'adb' && args.includes('avd')) process.stdout.write('simlock_qa\\nOK\\n');
else process.stdout.write('ok\\n');
`;

function setup(t, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'noctalia-simlock-test-'));
  const binary = join(root, 'simlock');
  const events = join(root, 'events.jsonl');
  writeFileSync(binary, fixture); chmodSync(binary, 0o700);
  const env = { ...process.env, E2E_SIMLOCK_BIN: binary, FAKE_EVENTS: events, ...extra };
  delete env.E2E_DEVICE;
  t.after(() => {
    // A failed assertion before release must not leave the fake holder keeping the suite alive.
    if (env.E2E_SIMLOCK_HOLDER_PID) try { process.kill(Number(env.E2E_SIMLOCK_HOLDER_PID), 'SIGKILL'); } catch { /* already gone */ }
    rmSync(root, { recursive: true, force: true });
  });
  return { root, env, events };
}
function calls(file) { return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse); }

test('only native runs without an explicit device use the automatic pool', () => {
  for (const platform of ['ios', 'android']) assert.equal(needsSimlock({ platform, command: 'run', env: {} }), true);
  assert.equal(needsSimlock({ platform: 'ios', command: 'list', env: {} }), false);
  assert.equal(needsSimlock({ platform: 'ios', command: 'build', env: {} }), false);
  assert.equal(needsSimlock({ platform: 'web', command: 'run', env: {} }), false);
  assert.equal(needsSimlock({ platform: 'android', command: 'run', env: { E2E_DEVICE: 'emulator-5554' } }), false);
});

test('a plain terminal gets one stable requester identity for its lease and release', async t => {
  const { root, env } = setup(t);
  delete env.CODEX_SESSION_ID; delete env.CLAUDE_CODE_SESSION_ID; delete env.SIMLOCK_AGENT_ID;
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  assert.match(env.SIMLOCK_AGENT_ID, /^noctalia-e2e-/);
  assert.equal(handle.evidence.requesterId, env.SIMLOCK_AGENT_ID);
  await handle.release();
});

for (const [variable, value, expected] of [
  ['CODEX_SESSION_ID', 'codex-test', 'codex:codex-test'],
  ['CLAUDE_CODE_SESSION_ID', 'claude-test', 'claude-code:claude-test'],
]) test(`${variable} keeps the agent's automatic Simlock identity`, async t => {
  const { root, env } = setup(t);
  delete env.CODEX_SESSION_ID; delete env.CLAUDE_CODE_SESSION_ID; delete env.SIMLOCK_AGENT_ID;
  env[variable] = value;
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  assert.equal(env.SIMLOCK_AGENT_ID, undefined);
  assert.equal(handle.evidence.requesterId, expected);
  await handle.release();
});

test('an empty SIMLOCK_AGENT_ID leaves the agent session identity to Simlock and the runner alike', async t => {
  const { root, env } = setup(t);
  delete env.CODEX_SESSION_ID;
  Object.assign(env, { SIMLOCK_AGENT_ID: '', CLAUDE_CODE_SESSION_ID: 'claude-test' });
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  assert.equal(handle.evidence.requesterId, 'claude-code:claude-test');
  await handle.release();
});

for (const platform of ['ios', 'android']) test(`${platform}: scopes the device and releases exactly its lease`, async t => {
  const { root, env, events } = setup(t);
  const handle = await acquireSimlock({ platform, env, shimDirectory: join(root, 'shims') });
  const state = env.AGENT_DEVICE_STATE_DIR;
  assert.ok(existsSync(state));
  assert.equal(env.E2E_SIMLOCK_LEASE_ID, 'lse_ours');
  if (platform === 'ios') {
    assert.equal(env.E2E_DEVICE, '12345678-1234-1234-1234-123456789abc');
    assert.equal(env.AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET, '/private/qa-set');
    execFileSync(process.execPath, [driver, 'xcrun', 'simctl', '--set', '/private/qa-set', 'get_app_container', env.E2E_DEVICE, 'qa'], { env });
    execFileSync(process.execPath, [driver, 'xcrun', 'simctl', 'get_app_container', env.E2E_DEVICE.toUpperCase(), 'qa'], { env });
    assert.throws(() => execFileSync(process.execPath, [driver, 'xcrun', 'simctl', '--set', '/private/foreign', 'list'], { env, stdio: 'pipe' }));
    assert.throws(() => execFileSync(process.execPath, [driver, 'xcrun', 'simctl', 'launch', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'qa'], { env, stdio: 'pipe' }));
  } else {
    assert.equal(env.E2E_DEVICE, 'emulator-5558');
    assert.equal(env.ADB_SERVER_SOCKET, 'tcp:127.0.0.1:5042');
    assert.equal(env.E2E_AVD_NAME, 'simlock_qa');
    execFileSync(process.execPath, [driver, 'adb', '-P', '5042', '-s', env.E2E_DEVICE, 'get-state'], { env });
    execFileSync(process.execPath, [driver, 'adb', '-s', env.E2E_DEVICE, 'shell', 'am', 'start', '-d', 'noctalia://journal'], { env });
    execFileSync(process.execPath, [driver, 'adb', '--version'], { env });
    assert.ok(calls(events).some(args => args.includes('-d') && args.includes('noctalia://journal')));
    assert.ok(calls(events).some(args => args.at(-1) === 'version'));
    assert.throws(() => execFileSync(process.execPath, [driver, 'adb', '-s', 'emulator-9999', 'get-state'], { env, stdio: 'pipe' }));
    assert.throws(() => execFileSync(process.execPath, [driver, 'adb', '-P', '5037', '-s', env.E2E_DEVICE, 'get-state'], { env, stdio: 'pipe' }));
    assert.equal(env.ANDROID_SDK_ROOT, join(state, 'android-sdk'));
    assert.equal(env.ANDROID_HOME, env.ANDROID_SDK_ROOT);
    assert.match(readFileSync(join(env.ANDROID_HOME, 'platform-tools', 'adb'), 'utf8'), /shims\/adb' "\$@"/);
  }
  const result = await handle.release();
  assert.equal(result.leaseId, 'lse_ours');
  assert.equal(result.released, true);
  assert.equal(existsSync(state), false);
  assert.throws(() => execFileSync(process.execPath, [driver, platform === 'ios' ? 'xcrun' : 'adb', ...(platform === 'ios' ? ['simctl', 'list'] : ['devices'])], { env, stdio: 'pipe' }), /SIMLOCK_LEASE_ENDED/);
  const invocations = calls(events);
  assert.equal(invocations[0][0], 'catalog');
  const lease = invocations.find(args => args[0] === 'lease');
  assert.ok(lease.includes('--bind-pid'));
  assert.equal(lease.includes('--allow-download'), false);
  assert.deepEqual(invocations.at(-1), ['release', 'lse_ours']);
});

test('android: agent-device reaches adb only through the shim, which keeps the real SDK for Simlock', async t => {
  const { root, env, events } = setup(t);
  // The real SDK records any direct call; agent-device would find it first without the per-run root.
  const real = join(root, 'real-sdk');
  mkdirSync(join(real, 'platform-tools'), { recursive: true });
  writeFileSync(join(real, 'platform-tools', 'adb'), `#!/bin/sh\necho '["real-adb"]' >> '${events}'\n`, { mode: 0o700 });
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = real;
  const handle = await acquireSimlock({ platform: 'android', env, shimDirectory: fileURLToPath(new URL('./simlock-bin', import.meta.url)) });
  const deviceCli = fileURLToPath(new URL('./node_modules/agent-device/bin/agent-device.mjs', import.meta.url));
  const state = ['--state-dir', env.AGENT_DEVICE_STATE_DIR];
  const agentEnv = { ...env, HOME: root };
  try {
    spawnSync(process.execPath, [deviceCli, 'devices', '--platform', 'android', ...state], { env: agentEnv, encoding: 'utf8', timeout: 60_000 });
  } finally {
    spawnSync(process.execPath, [deviceCli, 'daemon', 'stop', '--clean', ...state], { env: agentEnv, encoding: 'utf8', timeout: 30_000 });
  }
  const invocations = calls(events);
  assert.equal(invocations.some(args => args[0] === 'real-adb'), false);
  assert.ok(invocations.some(args => args[0] === 'adb' && args[1] === '--lease' && args.includes('devices')));
  // The shim restores the runner's SDK, so Simlock never resolves the shim as its adb.
  execFileSync(process.execPath, [driver, 'adb', 'version'], { env: { ...env, FAKE_SDK_PROBE: '1' } });
  assert.equal(calls(events).at(-1).at(-1), `sdk=${real}|${real}`);
  await handle.release();
});

test('a physical or malformed grant is refused and its own lease is returned', async t => {
  const { root, env, events } = setup(t, { FAKE_PHYSICAL: '1' });
  await assert.rejects(acquireSimlock({ platform: 'ios', env, shimDirectory: root }), /SIMLOCK_GRANT_INVALID/);
  assert.deepEqual(calls(events).at(-1), ['release', 'lse_ours']);
});

test('a grant attributed to another requester never triggers an explicit release of its ID', async t => {
  const { root, env, events } = setup(t, { FAKE_FOREIGN: '1' });
  await assert.rejects(acquireSimlock({ platform: 'ios', env, shimDirectory: root }), /SIMLOCK_REQUESTER_MISMATCH/);
  assert.equal(calls(events).some(args => args[0] === 'release'), false);
});

test('an iOS grant in the default device set clears a stale isolated-set setting', async t => {
  const { root, env } = setup(t, { FAKE_NO_IOS_SET: '1', SIMLOCK_IOS_DEVICE_SET: '/private/old', AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET: '/private/old' });
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  assert.equal(env.SIMLOCK_IOS_DEVICE_SET, undefined);
  assert.equal(env.AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET, undefined);
  await handle.release();
});

test('failed or mismatched release is never reported as successful', async t => {
  const { root, env, events } = setup(t, { FAKE_WRONG_RELEASE: '1' });
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  const state = env.AGENT_DEVICE_STATE_DIR;
  await assert.rejects(handle.release(), /SIMLOCK_RELEASE_UNPROVEN/);
  assert.equal(existsSync(state), false);
  assert.deepEqual(calls(events).at(-1), ['release', 'lse_ours']);
});

test('a release command failure retains the failure while cleaning the owned state', async t => {
  const { root, env } = setup(t, { FAKE_FAIL_RELEASE: '1' });
  const handle = await acquireSimlock({ platform: 'android', env, shimDirectory: root });
  const state = env.AGENT_DEVICE_STATE_DIR;
  await assert.rejects(handle.release(), /SIMLOCK_RELEASE_UNPROVEN/);
  assert.equal(existsSync(state), false);
});

test('unproven agent cleanup retains the explicitly reported state for diagnosis', async t => {
  const { root, env } = setup(t);
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  const state = env.AGENT_DEVICE_STATE_DIR;
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const result = await handle.release({ preserveState: true });
  assert.equal(result.retainedStateDirectory, state);
  assert.equal(existsSync(state), true);
  // A daemon left in that state can no longer reach the released device.
  assert.throws(() => execFileSync(process.execPath, [driver, 'xcrun', 'simctl', 'list'], { env, stdio: 'pipe' }), /SIMLOCK_LEASE_ENDED/);
});

test('an unavailable pool does not attempt to release another lease', async t => {
  const { root, env, events } = setup(t, { FAKE_DENY: '1' });
  await assert.rejects(acquireSimlock({ platform: 'ios', env, shimDirectory: root }), /SIMLOCK_LEASE_FAILED/);
  assert.deepEqual(calls(events).map(args => args[0]), ['catalog', 'lease']);
});

test('an interrupted reservation waits for the queued request and returns its late grant', async t => {
  const { root, env, events } = setup(t, { FAKE_WAIT: '1' });
  const modulePath = fileURLToPath(new URL('./simlock-native.mjs', import.meta.url));
  const script = `import { acquireSimlock } from ${JSON.stringify(new URL(`file://${modulePath}`).href)};\n` +
    `let interrupted = false; try { await acquireSimlock({ platform: 'ios', env: process.env, shimDirectory: ${JSON.stringify(root)}, onSignal: () => { interrupted = true; } }); } catch { process.exitCode = interrupted ? 143 : 3; }`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env, stdio: 'ignore' });
  const completed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)); });
  const deadline = Date.now() + 5000;
  while ((!existsSync(events) || !calls(events).some(args => args[0] === 'ready')) && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(existsSync(events) && calls(events).some(args => args[0] === 'ready'), 'the lease process started');
  child.kill('SIGTERM');
  assert.equal(await completed, 143);
  assert.deepEqual(calls(events).map(args => args[0]), ['catalog', 'lease', 'ready', 'late-grant', 'release']);
  assert.deepEqual(calls(events).at(-1), ['release', 'lse_late']);
});

test('a signal during the catalog check never queues a reservation', async t => {
  const { root, env, events } = setup(t, { FAKE_SLOW_CATALOG: '1' });
  const modulePath = fileURLToPath(new URL('./simlock-native.mjs', import.meta.url));
  const script = `import { acquireSimlock } from ${JSON.stringify(new URL(`file://${modulePath}`).href)};\n` +
    `try { await acquireSimlock({ platform: 'ios', env: process.env, shimDirectory: ${JSON.stringify(root)}, onSignal: () => {} }); process.exitCode = 3; } catch (error) { process.exitCode = error.message === 'SIMLOCK_INTERRUPTED' ? 143 : 4; }`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env, stdio: 'ignore' });
  const completed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)); });
  const deadline = Date.now() + 5000;
  while ((!existsSync(events) || !calls(events).some(args => args[0] === 'catalog')) && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 20));
  child.kill('SIGTERM');
  assert.equal(await completed, 143);
  assert.deepEqual(calls(events).map(args => args[0]), ['catalog']);
});

test('loss of a live lease is reported to the runner', async t => {
  const { root, env } = setup(t, { FAKE_LOSS: '1' });
  let resolveLoss;
  const lost = new Promise(resolve => { resolveLoss = resolve; });
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root, onLoss: resolveLoss });
  const result = await lost;
  assert.equal(result.code, 14);
  assert.ok(existsSync(env.E2E_SIMLOCK_END_MARKER));
  assert.throws(() => execFileSync(process.execPath, [driver, 'xcrun', 'simctl', 'list'], { env, stdio: 'pipe' }), /SIMLOCK_LEASE_ENDED/);
  await handle.release();
});

test('a holder that exits while the runner is blocked is refused before its marker exists', async t => {
  const { root, env } = setup(t, { FAKE_LOSS: '1', FAKE_LOSS_MS: '300' });
  const handle = await acquireSimlock({ platform: 'ios', env, shimDirectory: root });
  // A synchronous install or SDK collection blocks the loop past the holder's exit.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 900);
  assert.equal(existsSync(env.E2E_SIMLOCK_END_MARKER), false);
  assert.throws(() => execFileSync(process.execPath, [driver, 'xcrun', 'simctl', 'list'], { env, stdio: 'pipe' }), /SIMLOCK_LEASE_ENDED/);
  await new Promise(resolve => setTimeout(resolve, 50));
  await handle.release();
});

test('a terminal interrupt reaches the runner, not the granted holder', async t => {
  const { root, env, events } = setup(t);
  const modulePath = fileURLToPath(new URL('./simlock-native.mjs', import.meta.url));
  const script = `import { acquireSimlock } from ${JSON.stringify(new URL(`file://${modulePath}`).href)};\n` +
    `await acquireSimlock({ platform: 'ios', env: process.env, shimDirectory: ${JSON.stringify(root)} });\n` +
    `process.stdout.write(process.env.AGENT_DEVICE_STATE_DIR + '\\n'); setInterval(() => {}, 1000);`;
  // The runner leads its own group, as a terminal's foreground job would.
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env, stdio: ['ignore', 'pipe', 'ignore'], detached: true });
  const state = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', chunk => resolve(chunk.toString().trim()));
  });
  const holder = calls(events).find(args => args[0] === 'holder')[1];
  t.after(() => {
    rmSync(state, { recursive: true, force: true });
    try { process.kill(holder, 'SIGKILL'); } catch { /* already stopped */ }
  });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve(signal)));
  process.kill(-child.pid, 'SIGINT');
  assert.equal(await closed, 'SIGINT');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(calls(events).some(args => args[0] === 'holder-sigint'), false);
  process.kill(holder, 0);
});
