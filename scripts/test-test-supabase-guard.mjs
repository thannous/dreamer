import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  FORBIDDEN_PROJECT_REFS,
  TARGETS_FILE,
  TestTargetRefused,
  accountEmail,
  assertE2eAccountEmail,
  assertTestSupabaseTarget,
  loadAllowedRefs,
  readTestEnv,
  runGuarded,
} from './test-supabase-guard.mjs';

const PROD = 'usuyppgsmmowzizhaoqj';
const TEST_REF = 'abcdefghijklmnopqrst';
const OTHER_REF = 'zyxwvutsrqponmlkjihg';
const jwt = (payload) => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
const env = (overrides = {}) => ({
  E2E_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
  E2E_SUPABASE_PROJECT_REF: TEST_REF,
  E2E_SUPABASE_ANON_KEY: 'sb_publishable_test',
  E2E_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  E2E_ACCOUNT_DOMAIN: 'example.com',
  E2E_FREE_PASSWORD: 'free-password',
  E2E_PREMIUM_PASSWORD: 'premium-password',
  ...overrides,
});
const allowed = { allowedRefs: [TEST_REF] };
const refused = (fn, pattern) => assert.throws(fn, (error) => error instanceof TestTargetRefused && pattern.test(error.message));

test('pins the production ref as forbidden', () => {
  assert.deepEqual([...FORBIDDEN_PROJECT_REFS], [PROD]);
  const appJson = fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8');
  assert.ok(appJson.includes(`${PROD}.supabase.co`), 'app.json still names the production project');
});

test('allows an allowlisted test project', () => {
  assert.deepEqual(assertTestSupabaseTarget(env(), allowed), { ref: TEST_REF, url: `https://${TEST_REF}.supabase.co` });
  assert.equal(assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: `https://${TEST_REF}.supabase.co/` }), allowed).ref, TEST_REF);
});

test('refuses the production project, even when it is allowlisted', () => {
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: `https://${PROD}.supabase.co`, E2E_SUPABASE_PROJECT_REF: PROD }), { allowedRefs: [PROD] }), /production/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: `https://${PROD.toUpperCase()}.supabase.co` }), allowed), /production/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_PROJECT_REF: PROD }), allowed), /production/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: `https://proxy.example.com/${PROD}` }), allowed), /production/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_ANON_KEY: 'sb_publishable_MpacCRXT8NJRcx6q_ww_pw_L_TQWi3n' }), allowed), /production Supabase key/);
});

test('refuses an unknown project and fails closed on an empty allowlist', () => {
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`, E2E_SUPABASE_PROJECT_REF: OTHER_REF }), allowed), /not an allowlisted/);
  refused(() => assertTestSupabaseTarget(env(), { allowedRefs: [] }), /no test Supabase project is allowlisted/);
  refused(() => assertTestSupabaseTarget(env(), {}), /no test Supabase project is allowlisted/);
});

test('the committed allowlist is empty today, so every project is refused', () => {
  assert.deepEqual(loadAllowedRefs(TARGETS_FILE), []);
  refused(() => assertTestSupabaseTarget(env(), { allowedRefs: loadAllowedRefs(TARGETS_FILE) }), /no test Supabase project is allowlisted/);
});

test('refuses URLs that are not exactly https://<ref>.supabase.co', () => {
  for (const url of [
    undefined,
    'not a url',
    `http://${TEST_REF}.supabase.co`,
    `https://${TEST_REF}.supabase.co:8443`,
    `https://${TEST_REF}.supabase.co/rest/v1`,
    `https://${TEST_REF}.supabase.co.evil.example`,
    `https://user:pw@${TEST_REF}.supabase.co`,
    'http://127.0.0.1:54321',
    'https://db.example.com',
  ]) {
    refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_URL: url }), allowed), /E2E_SUPABASE_URL/);
  }
});

test('refuses a project ref or a legacy JWT key naming another project', () => {
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_PROJECT_REF: undefined }), allowed), /E2E_SUPABASE_PROJECT_REF/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_PROJECT_REF: OTHER_REF }), allowed), /E2E_SUPABASE_PROJECT_REF/);
  refused(() => assertTestSupabaseTarget(env({ E2E_SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: OTHER_REF, role: 'service_role' }) }), allowed), /SERVICE_ROLE_KEY belongs to another/);
  assert.equal(assertTestSupabaseTarget(env({ E2E_SUPABASE_ANON_KEY: jwt({ ref: TEST_REF, role: 'anon' }) }), allowed).ref, TEST_REF);
});

test('the guard runs before any network call', async () => {
  for (const [name, overrides, opts] of [
    ['production', { E2E_SUPABASE_URL: `https://${PROD}.supabase.co`, E2E_SUPABASE_PROJECT_REF: PROD }, { allowedRefs: [PROD] }],
    ['unknown', { E2E_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`, E2E_SUPABASE_PROJECT_REF: OTHER_REF }, allowed],
    ['empty allowlist', {}, { allowedRefs: [] }],
  ]) {
    let fetchCalls = 0;
    let actionCalls = 0;
    const fetch = async () => {
      fetchCalls += 1;
      return new Response('{}');
    };
    await assert.rejects(
      runGuarded(env(overrides), async ({ fetch: f }) => {
        actionCalls += 1;
        await f('https://example.invalid');
      }, { ...opts, fetch }),
      TestTargetRefused,
      name
    );
    assert.equal(fetchCalls, 0, name);
    assert.equal(actionCalls, 0, name);
  }
  let seen = null;
  const result = await runGuarded(env(), async ({ target, fetch }) => {
    seen = target;
    return fetch('https://x');
  }, { ...allowed, fetch: async () => 'called' });
  assert.equal(result, 'called');
  assert.equal(seen.ref, TEST_REF);
});

test('accepts only the e2e account emails', () => {
  assert.equal(accountEmail('free', 'Example.com'), 'e2e+free@example.com');
  assert.equal(accountEmail('premium', 'example.com'), 'e2e+premium@example.com');
  assert.equal(assertE2eAccountEmail('e2e+premium@example.com', 'example.com'), 'e2e+premium@example.com');
  for (const email of ['thanh@example.com', 'e2e@example.com', 'e2e+admin@example.com', 'e2e+free@other.com', 'E2E+free@example.com', ' e2e+free@example.com', 'e2e+free@example.com.evil']) {
    refused(() => assertE2eAccountEmail(email, 'example.com'), /only e2e\+free/);
  }
  for (const domain of ['', undefined, 'localhost', 'example.com/x', 'a@b.com', 'exa mple.com']) {
    refused(() => accountEmail('free', domain), /E2E_ACCOUNT_DOMAIN/);
  }
  refused(() => accountEmail('admin', 'example.com'), /unknown test account tier/);
});

test('readTestEnv takes only E2E_* names from .env.test.local, file over process env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-env-'));
  try {
    const file = path.join(dir, '.env.test.local');
    fs.writeFileSync(file, `E2E_SUPABASE_URL=https://${TEST_REF}.supabase.co\nE2E_FREE_PASSWORD=\nEXPO_PUBLIC_SUPABASE_URL=https://${PROD}.supabase.co\n`);
    const merged = readTestEnv({ file, env: { E2E_SUPABASE_PROJECT_REF: TEST_REF, E2E_SUPABASE_URL: 'https://ignored', PATH: '/bin' } });
    assert.deepEqual(merged, { E2E_SUPABASE_URL: `https://${TEST_REF}.supabase.co`, E2E_SUPABASE_PROJECT_REF: TEST_REF });
    assert.deepEqual(readTestEnv({ file: path.join(dir, 'missing'), env: {} }), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI refuses today (empty allowlist), prints no secret and makes no request', () => {
  const script = new URL('./test-supabase-guard.mjs', import.meta.url).pathname;
  const secret = 'sb_secret_should_never_print';
  let out = '';
  let code = 0;
  try {
    execFileSync(process.execPath, [script], {
      env: { PATH: process.env.PATH, ...env({ E2E_SUPABASE_SERVICE_ROLE_KEY: secret }) },
      cwd: os.tmpdir(),
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    code = error.status;
    out = `${error.stdout}${error.stderr}`;
  }
  assert.equal(code, 1);
  assert.match(out, /no test Supabase project is allowlisted/);
  assert.ok(!out.includes(secret));
  assert.ok(!out.includes('free-password'));
});
