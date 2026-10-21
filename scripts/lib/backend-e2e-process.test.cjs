'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { withOwnedProcess } = require('./backend-e2e-process.cjs');

// A live production/owned database need not be leaked to reproduce the wrapper
// defect. Real parent/child processes prove closure precedes the owner's finally.
for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  test(`${signal} closes the descendant before cleanup and preserves interruption`, { skip: process.platform === 'win32', timeout: 10_000 }, async () => {
    const source = `
      const { withOwnedProcess } = require(${JSON.stringify(require.resolve('./backend-e2e-process.cjs'))});
      withOwnedProcess(async run => {
        try {
          await run(process.execPath, ['-e', "console.log('READY ' + process.pid); setInterval(() => {}, 1000)"]);
        } finally { console.log('CLEANUP'); }
      }).catch(error => { process.exitCode = error.exitCode ?? 1; });
    `;
    const owner = spawn(process.execPath, ['-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    owner.stdout.on('data', chunk => { output += chunk; });
    const closed = once(owner, 'close');
    const ready = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Child never became ready')), 5_000);
      owner.stdout.on('data', () => {
        const match = /READY (\d+)/.exec(output);
        if (match) { clearTimeout(deadline); resolve(Number(match[1])); }
      });
    });
    try {
      const descendant = await ready;
      owner.kill(signal);
      assert.deepEqual(await closed, [exitCode, null]);
      assert.match(output, /READY \d+\s+CLEANUP/);
      assert.throws(() => process.kill(descendant, 0), { code: 'ESRCH' });
    } finally { if (owner.exitCode === null && owner.signalCode === null) owner.kill('SIGKILL'); }
  });
}

test('a failed runner stays failed and executes owner cleanup', async () => {
  let cleaned = false;
  await assert.rejects(withOwnedProcess(async run => {
    try { await run(process.execPath, ['-e', 'process.exit(7)']); }
    finally { cleaned = true; }
  }), /failed \(7\)/);
  assert.equal(cleaned, true);
});

test('success leaves no temporary parent signal handlers', async () => {
  const initial = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal));
  await withOwnedProcess(run => run(process.execPath, ['-e', 'process.exit(0)']));
  assert.deepEqual(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal)), initial);
});
