// Common contracts: every platform case below runs on every host.
// Native process-group/flock qualification is in test-verify-local-native.mjs.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { runParallel, runShell, STEP_SUPERVISOR } from './verify-local.mjs';

for (const platform of ['linux', 'darwin', 'win32']) {
  for (const lockState of ['free', 'busy', 'missing', 'inherited']) {
    for (const outcome of [{ status: 0 }, { status: 7 }, { status: null, signal: 'SIGTERM' }, { status: 137 }, { error: new Error('ENOENT') }]) {
      test(`${platform}: ${lockState} heavy lock, result ${outcome.signal ?? outcome.status ?? 'error'}`, () => {
        const calls = [], logs = [];
        const env = { VERIFY_LOCAL_HEAVY_LOCK: '/locks/heavy', ...(lockState === 'inherited' ? { VERIFY_LOCAL_HEAVY_LOCK_HELD: '/locks/heavy' } : {}) };
        const result = runShell('check', {
          cwd: '/work', env, platform, shell: '/shell', log: line => logs.push(line),
          flock: () => lockState !== 'missing',
          execute: (program, args, options) => {
            calls.push({ program, args, env: options.env });
            return program === 'flock' ? { status: lockState === 'busy' ? 1 : 0 } : outcome;
          },
          supervise: (lock, program, args, options) => {
            calls.push({ lock, program, args, env: options.env });
            return outcome;
          },
        });
        assert.equal(result.status === 0, outcome.status === 0);
        assert.equal(result.killed, outcome.signal ?? (outcome.status > 128 ? `signal ${outcome.status - 128}` : null));
        const supervised = platform !== 'win32' && lockState !== 'inherited';
        const locked = supervised && lockState !== 'missing';
        assert.equal(calls.length, locked ? 2 : 1);
        assert.deepEqual(calls.at(-1), {
          ...(supervised ? { lock: locked ? '/locks/heavy' : null } : {}),
          program: '/shell', args: ['-c', 'check'],
          env: locked ? { ...env, VERIFY_LOCAL_HEAVY_LOCK_HELD: '/locks/heavy' } : env,
        });
        assert.equal(logs.some(line => line.includes('waiting for lock')), locked && lockState === 'busy');
        assert.equal(logs.some(line => line.includes('Windows:')), platform === 'win32' && lockState !== 'inherited');
        assert.equal(logs.some(line => line.includes('flock is not installed')), supervised && lockState === 'missing');
        assert.ok(result.durationMs >= 0);
      });
    }
  }

  for (const failure of ['missing', 'malformed', 'supervisor']) {
    test(`${platform}: ${failure} parallel receipt fails closed`, () => {
      const tmp = mkdtempSync(path.join(os.tmpdir(), 'parallel-contract-'));
      try {
        const results = runParallel([{ name: 'a', command: 'unused' }, { name: 'b', command: 'unused' }], {
          cwd: tmp, tmp, shell: '/shell', env: {}, fixedEnv: {}, log: () => {},
          execute: () => {
            const file = path.join(tmp, readdirSync(tmp).find(name => !name.endsWith('.cjs')));
            writeFileSync(`${file}.0.json`, JSON.stringify({ status: 0, durationMs: 4, killed: null }));
            if (failure !== 'missing') writeFileSync(`${file}.1.json`, failure === 'malformed' ? '{' : JSON.stringify({ status: 0, durationMs: 6, killed: null }));
            return { status: 137, killed: 'SIGKILL', durationMs: 10 };
          },
        });
        assert.deepEqual(results[0], { status: 0, durationMs: 4, killed: null });
        assert.notEqual(results[1].status, 0);
        assert.equal(results[1].killed, 'SIGKILL');
        assert.equal(Boolean(results[1].missing), failure !== 'supervisor');
      } finally { rmSync(tmp, { recursive: true, force: true }); }
    });
  }
}

// Execute the real supervisor source against process/timer/pipe adapters.
// This exercises cleanup ordering without relying on the host's signals.
function supervisor({ lock = '/locks/heavy', stubborn = false } = {}) {
  const events = [], children = [], timers = [];
  let clock = 0, groupAlive = true;
  const proc = Object.assign(new EventEmitter(), {
    argv: ['node', JSON.stringify([100, lock, 999, ['/copies/check'], '/shell', '-c', 'check'])],
    stderr: { write: text => events.push(['stderr', text]) },
    exit: status => events.push(['exit', status]),
    kill(pid, signal) {
      events.push(['kill', pid, signal]);
      if (pid === 999) return;
      if (pid === -41 && signal === 'SIGKILL') { children[0].emit('exit', 137); return; }
      if (signal === 0 && !groupAlive) throw Object.assign(new Error('gone'), { code: 'ESRCH' });
      if (signal === 'SIGTERM' && !stubborn) groupAlive = false;
      if (signal === 'SIGKILL') groupAlive = false;
    },
  });
  const lifeline = new EventEmitter();
  const spawn = (program, args, options) => {
    const child = Object.assign(new EventEmitter(), { pid: children.length + 41, exitCode: null, signalCode: null, stdout: new EventEmitter() });
    children.push(child);
    events.push(['spawn', program, args, options]);
    return child;
  };
  vm.runInNewContext(STEP_SUPERVISOR, {
    require: name => ({
      'node:child_process': { spawn }, 'node:fs': { rmSync: file => events.push(['remove', file]) },
      'node:net': { Socket: function () { return lifeline; } },
      'node:os': { constants: { signals: { SIGINT: 2, SIGTERM: 15, SIGHUP: 1, SIGQUIT: 3 } } },
    })[name],
    process: proc, Date: { now: () => clock },
    setTimeout: (callback, ms) => timers.push(() => { clock += ms; callback(); }),
  });
  return { proc, lifeline, events, children, timers, tick: () => timers.shift()?.() };
}

for (const platform of ['linux', 'darwin']) {
  for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'end', 'error', 'child-exit']) {
    test(`${platform}: supervisor ${event} keeps lock through teardown and removes orphan copy`, () => {
      const s = supervisor({ stubborn: true });
      assert.equal(s.children.length, 1, 'step waits for lock acquisition');
      s.children[0].stdout.emit('data', 'locked\n');
      assert.equal(s.children.length, 2);
      if (event === 'child-exit') s.children[1].emit('exit', 7);
      else if (event === 'end' || event === 'error') s.lifeline.emit(event);
      else { s.proc.emit(event); s.lifeline.emit('end'); }
      const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'].includes(event);
      assert.ok(s.events.some(e => e[0] === 'kill' && e[1] === -42 && e[2] === (event === 'SIGINT' ? 'SIGINT' : 'SIGTERM')));
      assert.ok(!s.events.some(e => e[0] === 'kill' && e[1] === -41), 'lock still held during grace');
      while (s.timers.length) s.tick();
      const groupKill = s.events.findIndex(e => e[0] === 'kill' && e[1] === -42 && e[2] === 'SIGKILL');
      const holderKill = s.events.findIndex(e => e[0] === 'kill' && e[1] === -41 && e[2] === 'SIGKILL');
      assert.ok(groupKill >= 0 && holderKill > groupKill, 'group stopped before releasing lock');
      assert.equal(s.events.some(e => e[0] === 'remove'), event !== 'child-exit');
      assert.deepEqual(s.events.at(-1), ['exit', event === 'child-exit' ? 7 : 137]);
      if (forwarded) assert.equal(s.events.filter(e => e[0] === 'kill' && e[1] === -42 && ['SIGTERM', 'SIGINT'].includes(e[2])).length, 1, 'orphan notification does not send a duplicate signal');
    });
  }
}
