import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { createConnection } from 'node:net';
import { managedAppCommand } from './managed-app.ts';

function fixture(t, script) {
  const root = mkdtempSync(join(tmpdir(), 'managed app '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { serve: script } }));
  return root;
}
// A browser journey cannot assert which PID the SDK owns. Test the real local
// process lifecycle and unsupported script failure modes, identically on all OS.
test('managed Node startup follows package script changes without a shell wrapper', t => {
  const root = fixture(t, 'node ./server.cjs --flag=one');
  assert.deepEqual(managedAppCommand(root, 'serve'), { executable: process.execPath, args: ['./server.cjs', '--flag=one'] });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { serve: 'node ./server.cjs --flag=two' } }));
  assert.deepEqual(managedAppCommand(root, 'serve').args, ['./server.cjs', '--flag=two']);
});
test('managed Expo startup resolves its own project CLI and preserves arguments', t => {
  const root = fixture(t, 'expo start --web');
  const executable = join(root, 'node_modules/expo/bin/cli');
  assert.deepEqual(managedAppCommand(root, 'serve', directory => { assert.equal(directory, root); return executable; }),
    { executable: process.execPath, args: [executable, 'start', '--web'] });
});
test('real Dreamer, Lucid and Meditation scripts preserve their declared entry points', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  for (const [name, profile] of [['start:mock', '.env.mock'], ['start:lucid:mock', '.env.lucid.mock']])
    assert.deepEqual(managedAppCommand(root, name).args, ['./scripts/expo-safe-runner.js', '--profile', profile, 'start']);
  assert.deepEqual(managedAppCommand(join(root, 'apps/meditation'), 'web', () => '/owned expo/cli').args, ['/owned expo/cli', 'start', '--web']);
});
test('missing, shell-dependent and nested runner scripts fail before launching a process', t => {
  for (const script of [null, '', 'npm run serve', 'node --run serve', 'node ./server.js && echo bypass',
    'node "server name.js"', 'node ./server.js $TOKEN', 'node ./server.js %TOKEN%']) {
    const root = fixture(t, script);
    assert.throws(() => managedAppCommand(root, 'serve'), /managed app script|Managed app script/);
  }
});
test('the managed server PID is the direct child and its listening port closes on termination', { timeout: 20000 }, async t => {
  const root = fixture(t, 'node ./server.cjs');
  writeFileSync(join(root, 'server.cjs'), `const server = require('node:http').createServer((req, res) => res.end('owned'));
server.listen(0, '127.0.0.1', () => console.log(process.pid + ' ' + server.address().port));
setTimeout(() => process.exit(0), 15000).unref();`);
  const command = managedAppCommand(root, 'serve');
  const child = spawn(command.executable, command.args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const lines = createInterface({ input: child.stdout });
    const [line] = await once(lines, 'line', { signal: AbortSignal.timeout(10000) }); lines.close();
    const [pid, port] = line.split(' ').map(Number);
    assert.equal(pid, child.pid);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'owned');
    const exited = once(child, 'exit'); child.kill(); await exited;
    const status = await new Promise(resolve => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.on('connect', () => { socket.destroy(); resolve('still-listening'); });
      socket.on('error', error => resolve(error.code));
      socket.setTimeout(1000, () => { socket.destroy(); resolve('timeout'); });
    });
    assert.equal(status, 'ECONNREFUSED');
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  }
});
