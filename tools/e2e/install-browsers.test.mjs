import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserInstallArgs, installBrowsers } from './install-browsers.mjs';

function packages(t, matcherVersion = '1.64.1') {
  // Node resolves package entry points through filesystem aliases (e.g. /var on macOS).
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'browser installer ')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function pkg(name, version, extra = {}) {
    const directory = join(root, 'node_modules', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version, ...extra }));
    return directory;
  }
  const web = pkg('@e2e-dev/web', '0.15.3', { main: 'index.js' });
  writeFileSync(join(web, 'index.js'), '');
  pkg('playwright', matcherVersion);
  pkg('playwright-core', 'unrelated-root-version');
  const core = pkg('@e2e-dev/web/node_modules/playwright-core', '1.64.1');
  return { require: createRequire(join(root, 'package.json')), cli: join(core, 'cli.js') };
}

test('full and headless installs use the engine browser, even beside another root Playwright', t => {
  const fixture = packages(t);
  for (const args of [[], ['--with-deps'], ['--only-shell'], ['--with-deps', '--only-shell']])
    assert.deepEqual(browserInstallArgs(args, fixture.require), [fixture.cli, 'install', 'chromium', ...args]);
});

test('mismatched matcher and engine versions fail before browser installation', t => {
  assert.throws(() => browserInstallArgs([], packages(t, '1.63.0').require), /same Playwright/);
});

test('unknown switches and browsers fail before resolving any dependency', () => {
  for (const arg of ['--force', 'firefox', '--', '--only-shell=true'])
    assert.throws(() => browserInstallArgs([arg], { resolve() { assert.fail('resolution must not start'); } }), /Usage/);
});

function execution() {
  const processHost = Object.assign(new EventEmitter(), {
    execPath: 'node executable with spaces', env: { PATH: 'kept', PLAYWRIGHT_SKIP_BROWSER_GC: '0' },
  });
  const child = new EventEmitter();
  const calls = [], signals = [];
  child.kill = signal => signals.push(signal);
  const launch = (...args) => { calls.push(args); return child; };
  return { processHost, child, calls, signals, launch };
}

test('spawn uses arguments without shell parsing and preserves other tools browsers', async () => {
  const fixture = execution();
  const args = ['browser cli with spaces', 'install', 'chromium', '--only-shell'];
  const pending = installBrowsers(args, fixture);
  assert.deepEqual(fixture.calls, [[fixture.processHost.execPath, args, {
    stdio: 'inherit', env: { PATH: 'kept', PLAYWRIGHT_SKIP_BROWSER_GC: '1' },
  }]]);
  fixture.child.emit('exit', 0, null);
  assert.equal(await pending, 0);
});

test('cancellation reaches the installer and cannot become a successful exit', async () => {
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    const fixture = execution();
    const pending = installBrowsers(['cli'], fixture);
    fixture.processHost.emit(signal, signal);
    assert.deepEqual(fixture.signals, [signal]);
    fixture.child.emit('exit', null, signal);
    assert.equal(await pending, code);
    assert.equal(fixture.processHost.listenerCount(signal), 0);
  }
});

test('nonzero and unknown installer exits stay failures and release signal handlers', async () => {
  for (const [code, expected] of [[9, 9], [null, 1]]) {
    const fixture = execution();
    const pending = installBrowsers(['cli'], fixture);
    fixture.child.emit('exit', code, null);
    assert.equal(await pending, expected);
    for (const signal of ['SIGINT', 'SIGTERM']) assert.equal(fixture.processHost.listenerCount(signal), 0);
  }
});

test('spawn errors reject and release signal handlers', async () => {
  const fixture = execution();
  const pending = installBrowsers(['cli'], fixture);
  fixture.child.emit('error', new Error('spawn failed'));
  await assert.rejects(pending, /spawn failed/);
  for (const signal of ['SIGINT', 'SIGTERM']) assert.equal(fixture.processHost.listenerCount(signal), 0);
});
