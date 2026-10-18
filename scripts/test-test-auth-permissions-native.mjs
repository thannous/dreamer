// POSIX native enforcement, separate from portable permission-request contracts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { makeAuthAction } from './test-auth-setup.mjs';

test('native auth directory is 0700 and session files are 0600', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-permissions-'));
  const dir = path.join(parent, '.auth');
  try {
    const files = await makeAuthAction({ anonKey: 'fixture', passwords: { free: 'fixture' } }, { dir, log: () => {} })({
      target: { url: 'https://fixture.invalid', ref: 'fixture' },
      accounts: [{ tier: 'free', email: 'e2e+free@example.com' }],
      fetch: async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: '1', email: 'e2e+free@example.com' } })),
    });
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(files[0].file).mode & 0o777, 0o600);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
