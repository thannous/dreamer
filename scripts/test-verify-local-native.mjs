// Linux native qualification: requires flock, setsid and /proc. Run separately from common contracts.
// Tests of scripts/verify-local.mjs, the engine of the common delivery rule.
// Each repository keeps and pins its own copy. Run: node --test scripts/test-verify-local.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

import { existsSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';

import path from 'node:path';
import { test } from 'node:test';

import { checkReleaseProof, hasFlock, hasPdeathsig, readRunLog, verify } from './verify-local.mjs';

import { ENGINE, scratch, CONFIG, makeRepository, gone } from './test-support/verify-fixture.mjs';

  const parallelConfig = (lint, testCommand) => CONFIG
    .replace(`{ name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] }`,
      () => `{ name: 'lint', command: ${JSON.stringify(lint)}, inputs: ['src/**'], parallel: true, env: { ONLY_LINT: 'yes' } }`)
    .replace(`{ name: 'test', command: 'echo test >> "$RUN_LOG" && grep -q ok src/a.js && test -z "$GIT_DIR" && test -z "$FAIL_TEST"' }`,
      () => `{ name: 'test', command: ${JSON.stringify(testCommand)}, parallel: true, env: { ONLY_TEST: 'yes' } }`);
const left = dir => existsSync(dir) ? readdirSync(dir) : [];
test('a lost batch runner cannot turn missing completion receipts into a pass', async () => {
    const repo = makeRepository();
    repo.commit('lost runner', { 'verify-local.config.mjs': parallelConfig('kill -KILL $PPID', 'sleep 0.1; echo test >> "$RUN_LOG"') });
    const { status, proof } = await verify('pr', [], repo.options);
    assert.equal(status, 1);
    assert.ok(proof.checks.some((entry) => /completion receipt/.test(entry.reason ?? '')));
  });

test('killing the engine stops both parallel children before releasing the machine lock', async () => {
    const repo = makeRepository();
    repo.commit('parallel orphan', { 'verify-local.config.mjs': parallelConfig(
      'echo $$ > "$RUN_LOG.lint.pid"; sleep 300', 'echo $$ > "$RUN_LOG.test.pid"; sleep 300',
    ) });
    const files = ['lint', 'test'].map((name) => `${repo.env.RUN_LOG}.${name}.pid`);
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore' });
    const wait = async (condition) => {
      for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      return condition();
    };
    const lockFree = () => spawnSync('flock', ['--nonblock', repo.env.VERIFY_LOCAL_HEAVY_LOCK, 'true']).status === 0;
    try {
      assert.ok(await wait(() => files.every((file) => existsSync(file))), 'both children started');
      assert.equal(lockFree(), false);
      run.kill('SIGKILL');
      assert.ok(await wait(lockFree), 'lock released after supervisor cleanup');
      for (const file of files) assert.ok(await gone(Number(readFileSync(file, 'utf8'))), 'parallel child stopped');
    } finally {
      run.kill('SIGKILL');
      for (const file of files) if (existsSync(file)) try { process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

test('heavy steps wait for the machine-wide lock, and a step under it does not take it again', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const hold = (seconds) => new Promise((resolve) => {
      const holder = spawn('flock', [lock, 'sh', '-c', `echo held; exec sleep ${seconds}`], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
      holder.stdout.once('data', () => {
        holder.stdout.destroy();
        holder.unref();
        resolve(holder);
      });
    });

    // Free lock: no wait.
    assert.equal((await verify('pr', ['--force'], repo.options)).status, 0);
    assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')), repo.lines.join('\n'));

    // Held lock: the run says it waits, then passes once the holder is done.
    let holder = await hold(1);
    repo.lines.length = 0;
    const started = Date.now();
    assert.equal((await verify('pr', ['--force'], repo.options)).status, 0);
    assert.ok(repo.lines.some((line) => line.includes(`waiting for lock ${lock}`)), repo.lines.join('\n'));
    assert.ok(Date.now() - started >= 500, 'the run waited for the holder');

    // A run inside a step that already holds this lock does not wait for it.
    holder = await hold(30);
    try {
      repo.lines.length = 0;
      const nested = await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, VERIFY_LOCAL_HEAVY_LOCK_HELD: lock } });
      assert.equal(nested.status, 0);
      assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')));
    } finally {
      process.kill(-holder.pid, 'SIGKILL');
    }
  });

test('a process a check leaves behind is killed when the step ends, and the lock is free', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const pidFile = path.join(repo.work, '..', 'background.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('daemon', {
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sleep 30 > /dev/null 2>&1 & echo $! > ${pidFile}; echo lint >> "$RUN_LOG"'`),
    });
    try {
      assert.equal((await verify('pr', [], repo.options)).status, 0);
      // The next steps of the same run did not wait for the background process either.
      assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')), repo.lines.join('\n'));
      for (let i = 0; i < 50 && !existsSync(pidFile); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(existsSync(pidFile), 'the check left a background process');
      assert.equal(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0, 'the background process does not hold the lock');
      assert.ok(await gone(Number(readFileSync(pidFile, 'utf8'))), 'the background process was killed with the step group');
    } finally {
      if (existsSync(pidFile)) try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

test('a SIGKILLed verify run leaves no step process running and the lock free', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const stepPid = path.join(repo.work, '..', 'step.pid');
    const childPid = path.join(repo.work, '..', 'child.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    // The step's shell, a background child and a foreground sleep: all of them
    // belong to the step group the engine owns.
    repo.commit('slow', {
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sleep 300 > /dev/null 2>&1 & echo $! > ${childPid}; echo $$ > ${stepPid}; sleep 300'`),
    });
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore' });
    const wait = async (condition) => {
      for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      return condition();
    };
    const pids = () => [stepPid, childPid].map((file) => Number(readFileSync(file, 'utf8')));
    try {
      assert.ok(await wait(() => existsSync(stepPid) && existsSync(childPid)), 'the step started');
      assert.notEqual(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0, 'the step holds the lock');
      run.kill('SIGKILL');
      assert.ok(await wait(() => spawnSync('flock', ['--nonblock', lock, 'true']).status === 0), 'the lock is free after the run was killed');
      for (const pid of pids()) assert.ok(await gone(pid), `step process ${pid} was killed with the run`);
    } finally {
      run.kill('SIGKILL');
      for (const file of [stepPid, childPid]) if (existsSync(file)) try { process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

for (const [how, stopRun] of [
    ['a SIGKILLed verify', (run) => run.kill('SIGKILL')],
    // A closed terminal: HUP to the whole foreground group, the supervisor included.
    ['a SIGHUP to the verify group', (run) => process.kill(-run.pid, 'SIGHUP')],
    // Ctrl-backslash: QUIT to the whole foreground group.
    ['a SIGQUIT to the verify group', (run) => process.kill(-run.pid, 'SIGQUIT')],
  ]) test(`${how} stops the step with TERM first, so its trap frees a server it started in another session, and the lock is held until the trap is done`, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const dir = mkdtempSync(path.join(scratch, 'server-'));
    const port = await new Promise((resolve) => {
      const probe = net.createServer().listen(0, '127.0.0.1', () => { const {
  port: free
} = probe.address(); probe.close(() => resolve(free)); });
    });
    // Like the verify-skillcodex launcher: the server runs in its own session
    // (outside the step group), and the step's TERM trap stops it.
    writeFileSync(path.join(dir, 'step.sh'), [
      `setsid ${JSON.stringify(process.execPath)} -e "require('net').createServer().listen(${port}, '127.0.0.1')" &`,
      `echo $! > ${dir}/server.pid`,
      // A teardown that takes a while: the lock must stay held until it ends.
      `trap 'kill $(cat ${dir}/server.pid); sleep 1; echo done > ${dir}/teardown.done; exit 143' TERM`,
      `echo $$ > ${dir}/step.pid`,
      'sleep 300 &',
      'wait',
      '',
    ].join('\n'));
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('server', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sh ${dir}/step.sh'`) });
    const listening = () => new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
    });
    const waitFor = async (condition) => {
      for (let i = 0; i < 200; i += 1) {
        if (await condition()) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return condition();
    };
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore', detached: true });
    try {
      assert.ok(await waitFor(async () => existsSync(path.join(dir, 'step.pid')) && await listening()), 'the step started its server');
      stopRun(run);
      const lockFree = () => spawnSync('flock', ['--nonblock', repo.env.VERIFY_LOCAL_HEAVY_LOCK, 'true']).status === 0;
      assert.ok(await waitFor(async () => lockFree()), 'the lock is free once the step is stopped');
      assert.ok(existsSync(path.join(dir, 'teardown.done')), 'the lock was held until the step teardown ended');
      assert.ok(await waitFor(async () => !(await listening())), 'the server stopped: the port is free');
      assert.ok(await gone(Number(readFileSync(path.join(dir, 'server.pid'), 'utf8'))), 'the server in another session is gone');
      assert.ok(await gone(Number(readFileSync(path.join(dir, 'step.pid'), 'utf8'))), 'the step shell is gone');
      assert.equal(spawnSync('flock', ['--nonblock', repo.env.VERIFY_LOCAL_HEAVY_LOCK, 'true']).status, 0, 'the lock is free');
    } finally {
      run.kill('SIGKILL');
      for (const name of ['server.pid', 'step.pid']) {
        const file = path.join(dir, name);
        if (existsSync(file)) try { process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL'); } catch {}
      }
    }
  });

test('a step that ignores TERM is killed after the grace period', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const pidFile = path.join(repo.work, '..', 'stubborn.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('stubborn', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'trap "" TERM; echo $$ > ${pidFile}; sleep 300'`) });
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: { ...repo.env, VERIFY_LOCAL_STEP_GRACE_MS: '300' }, stdio: 'ignore' });
    try {
      for (let i = 0; i < 200 && !existsSync(pidFile); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(existsSync(pidFile), 'the step started');
      await new Promise((resolve) => setTimeout(resolve, 100));
      run.kill('SIGKILL');
      assert.ok(await gone(Number(readFileSync(pidFile, 'utf8'))), 'the step that ignores TERM was killed');
    } finally {
      run.kill('SIGKILL');
      if (existsSync(pidFile)) try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

test('without flock or setpriv on PATH, a step still runs, passes or fails, and the run says how it is locked', async () => {
    // A PATH with every command of this one except the hidden ones, so the
    // engine's own probes find them missing (as on macOS), on Linux too.
    const pathWithout = (hidden) => {
      const dir = mkdtempSync(path.join(scratch, 'path-'));
      for (const entry of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
        let names = [];
        try { names = readdirSync(entry); } catch { continue; }
        for (const name of names) {
          if (hidden.includes(name) || existsSync(path.join(dir, name))) continue;
          try { symlinkSync(path.join(entry, name), path.join(dir, name)); } catch {}
        }
      }
      return dir;
    };
    const unlocked = 'flock is not installed here: this step runs without the lock';
    for (const hidden of [['flock', 'setpriv'], ['flock'], ['setpriv']]) {
      const repo = makeRepository();
      const env = { ...repo.env, PATH: pathWithout(hidden) };
      assert.equal(hasFlock(env), !hidden.includes('flock') && hasFlock(), hidden.join(','));
      assert.equal(hasPdeathsig(env), !hidden.includes('setpriv') && hasPdeathsig(), hidden.join(','));

      repo.git(['checkout', '--quiet', '-b', 'feature']);
      repo.commit('feature', { 'src/b.js': '1\n' });
      const passed = await verify('pr', [], { ...repo.options, env });
      assert.equal(passed.status, 0, hidden.join(','));
      assert.ok(repo.runs().includes('lint'), 'the step ran');
      assert.equal(repo.lines.some((entry) => entry.includes(unlocked)), !hasFlock(env), `${hidden.join(',')}: ${repo.lines.join('\n')}`);
      repo.commit('break', { 'src/a.js': 'nope\n' });
      const failed = await verify('pr', [], { ...repo.options, env });
      assert.equal(failed.status, 1, hidden.join(','));
      assert.equal(failed.proof.result, 'failed');
    }
  });

test('a release killed mid-way is a run that did not pass, until a later real pass', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    const flag = path.join(repo.base, 'started');
    const head = repo.commit('slow', {
      'site/index.html': '<p>ok</p>\n',
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'if [ -n "$SLOW" ]; then touch "$SLOW"; sleep 300; fi; echo lint >> "$RUN_LOG"'`),
    });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    const run = spawn(process.execPath, [ENGINE, 'release'], { cwd: repo.work, env: { ...repo.env, SLOW: flag }, stdio: 'ignore' });
    const exited = new Promise((resolve) => run.on('exit', resolve));
    for (let i = 0; i < 400 && !existsSync(flag); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(existsSync(flag), 'the release is in its first check');
    run.kill('SIGKILL');
    await exited;
    const log = readRunLog(path.join(repo.work, '.git'), head);
    assert.equal(log.at(-1).result, 'interrupted');
    const failures = guard();
    assert.deepEqual(failures.map((failure) => failure.check), ['proof-latest-release', 'proof-open-check']);
    assert.match(failures[0].message, /the latest release run of [0-9a-f]{40} interrupted at /);
    assert.match(failures[1].message, /lint \(release interrupted at /);
    // A later real pass clears it.
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    // A run that ended leaves no open start behind.
    assert.ok(!readRunLog(path.join(repo.work, '.git'), head).slice(-1).some((entry) => entry.result === 'interrupted'));
  });

for (const signal of ['SIGTERM', 'SIGKILL']) test(`a verify run stopped by ${signal} during a step leaves no isolated copy`, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const tmp = mkdtempSync(path.join(scratch, 'tmpdir-'));
    const started = path.join(tmp, 'started');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('slow', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'touch ${started}; sleep 300'`) });
    const copies = path.join(tmp, 'verify-local');
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: { ...repo.env, TMPDIR: tmp }, stdio: 'ignore' });
    const wait = async (condition) => {
      for (let i = 0; i < 300 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      return condition();
    };
    try {
      assert.ok(await wait(() => existsSync(started)), 'the step started');
      assert.ok(left(copies).some((name) => name.endsWith('.owner')), 'the copy has an owner file');
      run.kill(signal);
      assert.ok(await wait(() => left(copies).length === 0), `copies left: ${left(copies).join(', ')}`);
    } finally {
      run.kill('SIGKILL');
    }
  });
