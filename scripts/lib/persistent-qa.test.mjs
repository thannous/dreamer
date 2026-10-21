import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withPersistentAccounts } from './persistent-qa.mjs';
import { withPersistentQaRun } from '../test-persistent-qa.mjs';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistent-qa-test-'));
  const accounts = ['free', 'premium'].map(tier => ({ tier, email: `e2e+${tier}@qa.example.test` }));
  const ids = Object.fromEntries(accounts.map(({ tier }) => [tier, randomUUID()]));
  const config = { ids, passwords: Object.fromEntries(accounts.map(({ tier }) => [tier, randomUUID()])),
    anonKey: `sb_publishable_${randomUUID()}`, authDir: path.join(dir, '.auth'), origin: 'http://127.0.0.1:8087' };
  const leases = new Map();
  const dreams = [{ id: 1, user_id: ids.free, client_request_id: randomUUID(), title: 'Kept team fixture' }];
  const sessions = new Map();
  const calls = [];
  const fail = {};
  const pending = [];
  const json = (status, value) => new Response(status === 204 ? null : JSON.stringify(value), { status });
  const fetch = async (input, init) => {
    const url = new URL(input); const method = init.method; const body = init.body ? JSON.parse(init.body) : undefined;
    const token = init.headers.Authorization?.replace('Bearer ', '');
    calls.push({ path: url.pathname, method, query: url.searchParams, body });
    assert.equal(init.redirect, 'error');
    if (fail.network) throw new Error(config.passwords.free);
    if (url.pathname === '/auth/v1/health') return json(200, {});
    if (url.pathname === '/auth/v1/token') {
      const account = accounts.find(account => account.email === body.email);
      const user = { id: fail.identity ? randomUUID() : ids[account.tier], email: account.email };
      const access = randomUUID(); sessions.set(access, user);
      return json(200, { access_token: access, refresh_token: randomUUID(), user, ...(fail.expiry ? {} : { expires_in: 3600 }) });
    }
    const user = sessions.get(token);
    assert.ok(user);
    if (url.pathname === '/auth/v1/user') return json(200, user);
    if (url.pathname === '/auth/v1/logout') { assert.equal(url.searchParams.get('scope'), 'local'); return json(204); }
    if (url.pathname.endsWith('/get_effective_subscription_tier')) return json(200, user.id === ids.premium ? 'plus' : 'free');
    if (url.pathname === '/rest/v1/qa_account_leases') {
      if (method === 'POST') {
        if (leases.has(user.id)) return json(409, {});
        if (fail.delayedClaim) { pending.push(() => leases.set(user.id, body)); throw new Error('Lost transport before commit'); }
        leases.set(user.id, body);
        if (fail.lostClaim) { fail.lostClaim = false; throw new Error('Lost claim response'); }
        return json(204);
      }
      const own = leases.get(user.id);
      if (own?.run_id === url.searchParams.get('run_id')?.slice(3)) { leases.delete(user.id); return json(200, [own]); }
      return json(200, []);
    }
    if (url.pathname === '/rest/v1/dreams') {
      if (method === 'POST') {
        assert.equal(body.user_id, user.id);
        const commit = () => dreams.push({ ...body, id: dreams.length + 1 });
        if (fail.delayedFixture) { pending.push(commit); throw new Error('Lost transport before commit'); }
        commit(); return json(204);
      }
      const requestId = url.searchParams.get('client_request_id')?.slice(3);
      const rows = dreams.filter(row => row.user_id === user.id && (!requestId || row.client_request_id === requestId));
      if (method === 'DELETE') {
        assert.ok(requestId, 'never delete all data of a reusable account');
        if (fail.cleanup) return json(503, { secret: config.passwords.free });
        for (const row of rows) dreams.splice(dreams.indexOf(row), 1);
        return json(204);
      }
      return json(200, rows);
    }
    throw new Error('Unexpected fixture request');
  };
  return { accounts, config, leases, dreams, calls, fail, pending, dir, context: { target: { ref: 'abcdefghijklmnopqrst', url: 'https://abcdefghijklmnopqrst.supabase.co' }, accounts, fetch } };
}

test('two completed runs retain identity and pre-existing data while removing only each run fixture', async () => {
  const f = fixture(); const seen = [];
  try {
    for (let run = 0; run < 2; run++) await withPersistentAccounts(f.context, f.config, async state => {
      seen.push(state.accounts); assert.equal(f.leases.size, 2); assert.equal(f.dreams.length, 3);
      assert.equal(fs.statSync(state.dir).mode & 0o777, 0o700);
      assert.equal(fs.statSync(path.join(state.dir, 'free.json')).mode & 0o777, 0o600);
      const saved = JSON.parse(fs.readFileSync(path.join(state.dir, 'free.json')));
      assert.ok(JSON.parse(saved.origins[0].localStorage[0].value).expires_at > Date.now() / 1000,
        'A GoTrue expires_in response becomes a recoverable persisted supabase-js session');
    });
    assert.deepEqual(seen[0], seen[1]); assert.equal(f.leases.size, 0);
    assert.deepEqual(f.dreams.map(row => row.title), ['Kept team fixture']);
    assert.deepEqual(fs.readdirSync(path.join(f.config.authDir, 'runs')), []);
    assert.ok(!f.calls.some(call => call.path.includes('/admin/') || call.path.includes('/storage/')));
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('a second runner cannot borrow either account and never releases the first runner lease', async () => {
  const f = fixture();
  try {
    await withPersistentAccounts(f.context, f.config, async () => {
      const held = [...f.leases.values()];
      await assert.rejects(withPersistentAccounts(f.context, f.config, () => assert.fail('busy account entered')), /QA_ACCOUNT_BUSY/);
      assert.deepEqual([...f.leases.values()], held); assert.equal(f.dreams.length, 3);
    });
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('an uncertain successful lock insert retains ownership and its recovery manifest', async () => {
  const f = fixture(); f.fail.lostClaim = true;
  try {
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => assert.fail()), /QA_RUN_FAILED_AND_CLEANUP_INCOMPLETE/);
    assert.equal(f.leases.size, 1); assert.equal(f.dreams.length, 1);
    const [run] = fs.readdirSync(path.join(f.config.authDir, 'runs'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.config.authDir, 'runs', run, 'manifest.json'))).status, 'recovery-required');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

for (const fault of ['delayedClaim', 'delayedFixture']) test(`${fault}: a late server commit cannot erase recovery or release its account`, async () => {
  const f = fixture(); f.fail[fault] = true;
  try {
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => assert.fail()), /QA_RUN_FAILED_AND_CLEANUP_INCOMPLETE/);
    assert.equal(f.pending.length, 1);
    const [run] = fs.readdirSync(path.join(f.config.authDir, 'runs'));
    const manifest = JSON.parse(fs.readFileSync(path.join(f.config.authDir, 'runs', run, 'manifest.json')));
    assert.equal(manifest.status, 'recovery-required');
    f.pending[0](); // commit only after all immediate cleanup observations have finished
    assert.equal(f.leases.size, 1);
    assert.ok([...f.leases.values()].every(row => row.run_id === run));
    if (fault === 'delayedFixture') assert.ok(f.dreams.some(row => row.client_request_id === manifest.accounts[0].requestId));
    assert.ok(fs.existsSync(path.join(f.config.authDir, 'runs', run, 'manifest.json')));
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('a cleanup failure retains the leases and private recovery manifest; response secrets never reach errors', async () => {
  const f = fixture(); f.fail.cleanup = true;
  try {
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => {}), error => {
      assert.equal(error.message, 'QA_CLEANUP_INCOMPLETE');
      assert.ok(!error.message.includes(f.config.passwords.free)); return true;
    });
    assert.equal(f.leases.size, 2);
    const [run] = fs.readdirSync(path.join(f.config.authDir, 'runs'));
    const manifest = JSON.parse(fs.readFileSync(path.join(f.config.authDir, 'runs', run, 'manifest.json')));
    assert.equal(manifest.accounts.length, 2); assert.equal(f.dreams[0].title, 'Kept team fixture');
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('unexpected identity refuses all locks/data writes; body errors still clean the owned data', async () => {
  const f = fixture(); f.fail.identity = true;
  try {
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => assert.fail()), /QA_IDENTITY_MISMATCH/);
    assert.ok(!f.calls.some(call => call.path.startsWith('/rest/')));
    f.fail.identity = false;
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => { throw new Error('Body failed'); }), /Body failed/);
    assert.equal(f.leases.size, 0); assert.equal(f.dreams.length, 1);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('production and missing QA configuration refuse before network or credentials', async () => {
  let called = false;
  for (const env of [{}, { E2E_SUPABASE_URL: 'https://usuyppgsmmowzizhaoqj.supabase.co' }]) {
    await assert.rejects(withPersistentQaRun(() => assert.fail(), { env, fetch: () => { called = true; } }), /test-login refused/);
  }
  assert.equal(called, false);
});

test('a login without usable expiry cannot export an invalid browser session or write data', async () => {
  const f = fixture(); f.fail.expiry = true;
  try {
    await assert.rejects(withPersistentAccounts(f.context, f.config, () => assert.fail()), /QA_SESSION_EXPIRY_REQUIRED/);
    assert.ok(!f.calls.some(call => call.path.startsWith('/rest/')));
    assert.equal(f.dreams.length, 1); assert.equal(f.leases.size, 0);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});
