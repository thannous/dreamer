import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _runGuardedWithListsForTests, TestTargetRefused } from './test-supabase-guard.mjs';
import { TIER_STATE, keyHeaders, main as seedMain, makeSeedAction, readSeedSecrets } from './test-seed-users.mjs';
import { BRANCH_WEB_ORIGIN, BRANCH_WEB_PORT, main as authMain, makeAuthAction, readAuthSecrets, storageKey } from './test-auth-setup.mjs';
import { BRANCH_GUARD_MARKER, PASSTHROUGH_EXPO_PUBLIC, RUNNER, branchAppEnv, branchCommand, main as startMain, parseBranchArgs } from './start-branch-e2e.mjs';
import { FLOW, main as maestroMain, maestroArgs, maestroEnv, runRecord } from './maestro-branch-sign-in.mjs';

const PROD = 'usuyppgsmmowzizhaoqj';
const REF = 'abcdefghijklmnopqrst';
const SERVICE = 'sb_secret_service_value_123';
const ANON = 'sb_publishable_anon_value_123';
const FREE_PW = 'free-password-123456';
const PREMIUM_PW = 'premium-password-123456';
const env = (overrides = {}) => ({
  E2E_SUPABASE_URL: `https://${REF}.supabase.co`,
  E2E_SUPABASE_PROJECT_REF: REF,
  E2E_SUPABASE_ANON_KEY: ANON,
  E2E_SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  E2E_ACCOUNT_DOMAIN: 'example.com',
  E2E_FREE_PASSWORD: FREE_PW,
  E2E_PREMIUM_PASSWORD: PREMIUM_PW,
  ...overrides,
});
const prodEnv = () => env({ E2E_SUPABASE_URL: `https://${PROD}.supabase.co`, E2E_SUPABASE_PROJECT_REF: PROD });

// A fake test branch: GoTrue admin + PostgREST + token endpoint, recording calls.
function fakeBranch({ users = [], failRpc = false } = {}) {
  const state = { users: users.map((user) => ({ ...user })), dreamsDeleted: [], quotaDeleted: [], hdDeleted: [], rpc: [], calls: [], nextId: 1 };
  const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status });
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ method, url: url.href, headers: init.headers, body });
    assert.equal(url.origin, `https://${REF}.supabase.co`, 'every request goes to the guarded target');
    if (url.pathname === '/auth/v1/admin/users' && method === 'GET') {
      const page = Number(url.searchParams.get('page'));
      const per = Number(url.searchParams.get('per_page'));
      return json(200, { users: state.users.slice((page - 1) * per, page * per) });
    }
    if (url.pathname === '/auth/v1/admin/users' && method === 'POST') {
      const user = { id: `u${state.nextId++}`, email: body.email, password: body.password, confirmed: body.email_confirm };
      state.users.push(user);
      return json(200, { id: user.id, email: user.email });
    }
    const update = url.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (update && method === 'PUT') {
      const user = state.users.find((entry) => entry.id === update[1]);
      Object.assign(user, { password: body.password, confirmed: body.email_confirm });
      return json(200, { id: user.id, email: user.email });
    }
    if (url.pathname === '/rest/v1/dreams' && method === 'DELETE') {
      state.dreamsDeleted.push(url.searchParams.get('user_id'));
      return json(204);
    }
    if (url.pathname === '/rest/v1/hd_image_credits' && method === 'DELETE') {
      state.hdDeleted.push(url.searchParams.get('user_id'));
      return json(204);
    }
    if (url.pathname === '/rest/v1/quota_usage' && method === 'DELETE') {
      state.quotaDeleted.push(url.searchParams.get('user_id'));
      return json(204);
    }
    if (url.pathname === '/rest/v1/rpc/apply_subscription_state_update') {
      if (failRpc) return json(403, { message: `denied for key ${SERVICE} and ${PREMIUM_PW}` });
      state.rpc.push(body);
      return json(200, { outcome: 'applied' });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const user = state.users.find((entry) => entry.email === body.email && entry.password === body.password);
      if (!user) return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, { access_token: `at-${user.id}`, refresh_token: `rt-${user.id}`, token_type: 'bearer', expires_in: 3600, user: { id: user.id, email: user.email } });
    }
    return json(404, { message: 'unexpected' });
  };
  return { state, fetch };
}

const seed = (branch, options = {}) =>
  _runGuardedWithListsForTests(env(options.env), makeSeedAction(readSeedSecrets(env(options.env)), { log: options.log ?? (() => {}), randomUUID: () => 'event-id' }), { allowedRefs: [REF], fetch: branch.fetch });

test('seed creates both accounts, confirms them, clears dreams and sets the tiers like the local fixture', async () => {
  const branch = fakeBranch();
  const logs = [];
  const result = await seed(branch, { log: (line) => logs.push(line) });
  assert.deepEqual(result.map(({ email, action }) => [email, action]), [['e2e+free@example.com', 'created'], ['e2e+premium@example.com', 'created']]);
  assert.deepEqual(branch.state.users.map(({ email, password, confirmed }) => ({ email, password, confirmed })), [
    { email: 'e2e+free@example.com', password: FREE_PW, confirmed: true },
    { email: 'e2e+premium@example.com', password: PREMIUM_PW, confirmed: true },
  ]);
  assert.deepEqual(branch.state.dreamsDeleted, ['eq.u1', 'eq.u2']);
  assert.deepEqual(branch.state.quotaDeleted, ['eq.u1', 'eq.u2']);
  assert.deepEqual(branch.state.hdDeleted, ['eq.u1', 'eq.u2']);
  const hdMigration = fs.readFileSync(new URL('../supabase/migrations/20260916185856_hd_illustration_monthly_quota.sql', import.meta.url), 'utf8');
  assert.match(hdMigration, /create table public\.hd_image_credits \([\s\S]*?user_id uuid not null/);
  assert.match(hdMigration, /grant all on public\.hd_image_credits to service_role;/);
  // Same argument names and premium values as e2e/backend/fixtures.ts.
  assert.deepEqual(branch.state.rpc, [
    { p_user_id: 'u1', p_tier: 'free', p_is_active: false, p_source: 'e2e-seed', p_source_event_id: 'event-id' },
    { p_user_id: 'u2', p_tier: 'plus', p_is_active: true, p_source: 'e2e-seed', p_source_event_id: 'event-id' },
  ]);
  const fixture = fs.readFileSync(new URL('../e2e/backend/fixtures.ts', import.meta.url), 'utf8');
  assert.match(fixture, /apply_subscription_state_update', \{\s*p_user_id: account\.id, p_tier: 'plus', p_is_active: true,\s*p_source: 'local-e2e-fixture', p_source_event_id: randomUUID\(\),/);
  assert.deepEqual(TIER_STATE.premium, { p_tier: 'plus', p_is_active: true });
  for (const call of branch.state.calls) {
    assert.equal(call.headers.apikey, SERVICE);
    assert.equal(call.headers.Authorization, undefined, 'new secret keys go on apikey only');
  }
  const printed = logs.join('\n');
  for (const secret of [SERVICE, ANON, FREE_PW, PREMIUM_PW]) assert.ok(!printed.includes(secret));
});

test('seed is idempotent: a second run resets the same accounts instead of creating new ones', async () => {
  const branch = fakeBranch({ users: [{ id: 'other', email: 'someone@example.com' }] });
  await seed(branch);
  const usersAfterFirst = branch.state.users.length;
  branch.state.users[1].password = 'changed-by-hand';
  const second = await seed(branch);
  assert.equal(branch.state.users.length, usersAfterFirst);
  assert.deepEqual(second.map(({ action }) => action), ['reset', 'reset']);
  assert.equal(branch.state.users[1].password, FREE_PW);
  assert.equal(branch.state.users[0].password, undefined, 'a non-test user is never touched');
  assert.ok(!branch.state.calls.some((call) => call.url.includes('/admin/users/other')));
});

test('seed finds an existing account beyond the first page', async () => {
  const filler = Array.from({ length: 200 }, (_, index) => ({ id: `f${index}`, email: `user${index}@example.com` }));
  const branch = fakeBranch({ users: [...filler, { id: 'late', email: 'e2e+premium@example.com' }] });
  const result = await seed(branch);
  assert.deepEqual(result.map(({ action, id }) => [action, id]), [['created', 'u1'], ['reset', 'late']]);
});

test('seed errors are redacted and stop the run', async () => {
  const branch = fakeBranch({ failRpc: true });
  await assert.rejects(seed(branch), (error) => {
    assert.match(error.message, /apply_subscription_state_update failed \(403\)/);
    assert.ok(!error.message.includes(SERVICE));
    assert.ok(!error.message.includes(PREMIUM_PW));
    return true;
  });
});

test('key headers: new keys on apikey only, legacy JWT keys also as Bearer', () => {
  assert.deepEqual(keyHeaders('sb_secret_x'), { apikey: 'sb_secret_x' });
  assert.deepEqual(keyHeaders('eyJhbGciOi.x.y'), { apikey: 'eyJhbGciOi.x.y', Authorization: 'Bearer eyJhbGciOi.x.y' });
});

test('seed refuses weak or missing secrets before any request', () => {
  assert.throws(() => readSeedSecrets(env({ E2E_SUPABASE_SERVICE_ROLE_KEY: '' })), /SERVICE_ROLE_KEY/);
  assert.throws(() => readSeedSecrets(env({ E2E_FREE_PASSWORD: 'short' })), /E2E_FREE_PASSWORD/);
  assert.throws(() => readSeedSecrets(env({ E2E_PREMIUM_PASSWORD: undefined })), /E2E_PREMIUM_PASSWORD/);
});

test('the CLIs refuse production, an unlisted project (committed allowlist is empty) and a bad domain before any request', async () => {
  for (const target of [prodEnv(), env(), env({ E2E_ACCOUNT_DOMAIN: 'thanh@example.com' })]) {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return new Response('{}');
    };
    await assert.rejects(seedMain({ env: target, fetch, log: () => {} }), TestTargetRefused);
    await assert.rejects(authMain({ env: target, fetch, log: () => {}, dir: os.tmpdir() }), TestTargetRefused);
    assert.equal(calls, 0);
  }
});

test('auth setup writes one storageState per account in the shape the web client reads', async () => {
  const branch = fakeBranch();
  await seed(branch);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-'));
  try {
    const logs = [];
    const written = await _runGuardedWithListsForTests(env(), makeAuthAction(readAuthSecrets(env()), { dir: path.join(dir, '.auth'), log: (line) => logs.push(line), now: () => 1_000_000 }), { allowedRefs: [REF], fetch: branch.fetch });
    assert.deepEqual(written.map(({ tier }) => tier), ['free', 'premium']);
    for (const { tier, file } of written) {
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      const state = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.deepEqual(state.cookies, []);
      assert.equal(state.origins.length, 1);
      assert.equal(state.origins[0].origin, BRANCH_WEB_ORIGIN);
      const [entry] = state.origins[0].localStorage;
      assert.equal(entry.name, `sb-${REF}-auth-token`);
      assert.equal(entry.name, storageKey(REF));
      const session = JSON.parse(entry.value);
      assert.equal(session.user.email, `e2e+${tier}@example.com`);
      assert.ok(session.access_token && session.refresh_token);
      assert.equal(session.expires_at, 1000 + 3600);
    }
    assert.equal(fs.statSync(path.join(dir, '.auth')).mode & 0o777, 0o700);
    const tokenCalls = branch.state.calls.filter((call) => call.url.includes('/auth/v1/token'));
    assert.equal(tokenCalls.length, 2);
    for (const call of tokenCalls) assert.equal(call.headers.apikey, ANON);
    const printed = logs.join('\n');
    for (const secret of [SERVICE, ANON, FREE_PW, PREMIUM_PW, 'at-u1', 'rt-u1']) assert.ok(!printed.includes(secret));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('auth setup fails clearly on bad credentials and prints no password', async () => {
  const branch = fakeBranch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-'));
  try {
    await assert.rejects(
      _runGuardedWithListsForTests(env(), makeAuthAction(readAuthSecrets(env()), { dir, log: () => {} }), { allowedRefs: [REF], fetch: branch.fetch }),
      (error) => /password login failed for e2e\+free@example\.com \(400, invalid_credentials\)/.test(error.message) && !error.message.includes(FREE_PW)
    );
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the web origin matches playwright.branch.config.ts and .auth/ is gitignored', () => {
  const config = fs.readFileSync(new URL('../playwright.branch.config.ts', import.meta.url), 'utf8');
  assert.match(config, new RegExp(`const port = ${BRANCH_WEB_PORT};`));
  assert.match(fs.readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^\.auth\/$/m);
});

test('start-branch-e2e gives the app only the branch URL, anon key and functions URL, never admin secrets', () => {
  const child = branchAppEnv({ ref: REF, url: `https://${REF}.supabase.co` }, env(), { PATH: '/bin', E2E_SUPABASE_SERVICE_ROLE_KEY: SERVICE, E2E_FREE_PASSWORD: FREE_PW, EXPO_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, EXPO_PUBLIC_REVENUECAT_WEB_KEY: 'test_web', EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_x', EXPO_PUBLIC_SUPABASE_FUNCTION_JWT: 'eyJprod.jwt.x' });
  assert.equal(child.EXPO_PUBLIC_SUPABASE_URL, `https://${REF}.supabase.co`);
  assert.equal(child.EXPO_PUBLIC_SUPABASE_ANON_KEY, ANON);
  assert.equal(child.EXPO_PUBLIC_API_URL, `https://${REF}.functions.supabase.co/api`);
  assert.equal(child.EXPO_PUBLIC_MOCK_MODE, 'false');
  assert.equal(child.EXPO_NO_DOTENV, '1');
  assert.equal(child.EXPO_PUBLIC_SUPABASE_FUNCTION_JWT, ANON, 'never the production JWT from app.json');
  assert.equal(child.EXPO_PUBLIC_REVENUECAT_WEB_KEY, undefined);
  assert.equal(child.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, undefined);
  assert.equal(child.PATH, '/bin');
  // Only the allowlisted EXPO_PUBLIC_* flags pass; every other one is dropped.
  const shell = {
    PATH: '/bin',
    EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED: 'true',
    EXPO_PUBLIC_TURNSTILE_SITE_KEY: 'prod-site-key',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'prod-client',
    EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true',
    EXPO_PUBLIC_MOCK_PERSISTENCE: 'true',
    EXPO_PUBLIC_SOMETHING_NEW: 'x',
    EXPO_PUBLIC_APP_VARIANT: 'lucid',
    NOCTALIA_APP_VARIANT: 'lucid',
    NOCTALIA_DREAMER_QA_BUILD: '1',
  };
  const filtered = branchAppEnv({ ref: REF, url: `https://${REF}.supabase.co` }, env(), shell);
  const publicNames = Object.keys(filtered).filter((name) => name.startsWith('EXPO_PUBLIC_')).sort();
  assert.deepEqual(publicNames, [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED',
    'EXPO_PUBLIC_MOCK_MODE',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_SUPABASE_FUNCTION_JWT',
    'EXPO_PUBLIC_SUPABASE_URL',
  ]);
  assert.ok(PASSTHROUGH_EXPO_PUBLIC.every((name) => !/KEY|URL|TOKEN|SECRET|CLIENT|JWT/.test(name)));
  assert.deepEqual(Object.keys(filtered).filter((name) => name.startsWith('NOCTALIA_')), [], 'product selectors are dropped');
  // A service key in the anon slot never reaches the bundle.
  assert.throws(() => branchAppEnv({ ref: REF, url: `https://${REF}.supabase.co` }, env({ E2E_SUPABASE_ANON_KEY: SERVICE }), shell), TestTargetRefused);
  assert.ok(!JSON.stringify(child).includes(SERVICE));
  assert.ok(!JSON.stringify(child).includes(FREE_PW));
  assert.ok(!JSON.stringify(child).includes(PROD));
  let spawned = false;
  assert.throws(() => startMain([], { env: prodEnv(), spawnImpl: () => { spawned = true; } }), TestTargetRefused);
  assert.throws(() => startMain([], { env: env(), spawnImpl: () => { spawned = true; } }), TestTargetRefused);
  assert.equal(spawned, false);
});

test('start-branch-e2e accepts only an allowlist of Expo args and refuses the rest before the guard or a spawn', () => {
  assert.deepEqual(parseBranchArgs([]), []);
  assert.deepEqual(
    parseBranchArgs(['--web', '--port', '8087', '--dev-client', '--clear', '--lan', '--localhost']),
    ['--web', '--port', '8087', '--dev-client', '--clear', '--lan', '--localhost'],
  );
  assert.deepEqual(parseBranchArgs(['--port', '1']), ['--port', '1']);
  assert.deepEqual(parseBranchArgs(['--port', '65535']), ['--port', '65535']);
  for (const bad of [
    ['--profile', '.env.playstore'],
    ['--profile=.env.playstore'],
    ['-p', '.env.playstore'],
    ['--web', '--', '--profile', '.env.playstore'],
    ['--'],
    ['.env.playstore'],
    ['start'],
    ['--port'],
    ['--port', '0'],
    ['--port', '65536'],
    ['--port', '80a'],
    ['--port', '-1'],
    ['--port', '1e3'],
    ['--port', ' 8087'],
    ['--port=8087'],
    ['--WEB'],
    ['--web=1'],
    ['--tunnel'],
    ['--android'],
  ]) {
    assert.throws(() => parseBranchArgs(bad), /start-branch-e2e: (argument|--port)/, JSON.stringify(bad));
    let spawned = false;
    // With a valid-looking env too: the argv check comes first, nothing spawns.
    assert.throws(() => startMain(bad, { env: env(), spawnImpl: () => { spawned = true; } }), /start-branch-e2e: (argument|--port)/);
    assert.throws(() => startMain(bad, { env: prodEnv(), spawnImpl: () => { spawned = true; } }), /start-branch-e2e: (argument|--port)/);
    assert.equal(spawned, false);
  }
});

test('start-branch-e2e hands the runner the guard marker and EXPO_NO_DOTENV=1, and a marker from the shell cannot weaken it', () => {
  const target = { ref: REF, url: `https://${REF}.supabase.co` };
  const command = branchCommand(['--web'], target, env({ EXPO_NO_DOTENV: '0', [BRANCH_GUARD_MARKER]: '0' }));
  assert.deepEqual(command.args, [RUNNER, 'start', '--web']);
  assert.equal(command.env[BRANCH_GUARD_MARKER], '1');
  assert.equal(command.env.EXPO_NO_DOTENV, '1');
  assert.equal(command.env.EXPO_PUBLIC_SUPABASE_URL, target.url);
  assert.ok(RUNNER.endsWith(path.join('scripts', 'expo-safe-runner.js')));
});

test('maestro wrapper: credentials from the loaded env, only as MAESTRO_* env vars, guard first', () => {
  const child = maestroEnv('premium', env({ E2E_ACCOUNT_DOMAIN: 'Example.com' }), { PATH: '/bin', E2E_SUPABASE_SERVICE_ROLE_KEY: SERVICE, MAESTRO_E2E_EMAIL: 'stale@example.com' });
  assert.deepEqual(child, { PATH: '/bin', MAESTRO_E2E_EMAIL: 'e2e+premium@example.com', MAESTRO_E2E_PASSWORD: PREMIUM_PW });
  assert.throws(() => maestroEnv('admin', env()), /tier must be/);
  assert.throws(() => maestroEnv('free', env({ E2E_FREE_PASSWORD: '' })), /E2E_FREE_PASSWORD/);
  for (const bad of ['mot-de-passe-été-1', 'has a space 1234', 'tab\tinside12345', 'emoji-🔑-123456']) {
    assert.throws(() => maestroEnv('free', env({ E2E_FREE_PASSWORD: bad })), /printable ASCII/);
    assert.throws(() => readSeedSecrets(env({ E2E_FREE_PASSWORD: bad })), /printable ASCII/);
  }
  const record = runRecord({ tier: 'free', target: { ref: REF }, appId: 'com.tanuki75.noctalia', git: (args) => (args[0] === 'rev-parse' ? 'abc123' : '') });
  assert.deepEqual(record, {
    kind: 'branch-e2e-mobile-sign-in (dev loop, not release evidence)',
    sourceRevision: 'abc123',
    dirty: false,
    backend: `supabase branch ref ${REF}`,
    appId: 'com.tanuki75.noctalia',
    tier: 'free',
    flow: FLOW,
    rerunCommand: 'npm run test:e2e:branch:mobile -- free',
  });
  assert.ok(!JSON.stringify(record).includes(FREE_PW));
  assert.throws(() => maestroEnv('free', env({ E2E_ACCOUNT_DOMAIN: 'thanh@example.com' })), TestTargetRefused);
  const calls = [];
  const spawnImpl = (...args) => { calls.push(args); };
  assert.throws(() => maestroMain(['free'], { env: prodEnv(), spawnImpl, writeRecord: false }), TestTargetRefused);
  assert.throws(() => maestroMain(['free'], { env: env(), spawnImpl, writeRecord: false }), TestTargetRefused, 'committed allowlist is empty');
  assert.equal(calls.length, 0);
  assert.equal(FLOW, 'maestro/e2e-account-sign-in.yml');
  assert.ok(fs.existsSync(new URL(`../${FLOW}`, import.meta.url)));
});

test('maestro wrapper: only --device passes; -e/--env credential overrides and other args are refused before the guard', () => {
  assert.deepEqual(maestroArgs([]), []);
  assert.deepEqual(maestroArgs(['--device', 'emulator-5554']), ['--device', 'emulator-5554']);
  for (const bad of [
    ['-e', 'MAESTRO_E2E_EMAIL=e2e+free@other.example'],
    ['--env', 'MAESTRO_E2E_PASSWORD=x'],
    ['--env=MAESTRO_E2E_EMAIL=e2e+free@other.example'],
    ['-eMAESTRO_E2E_EMAIL=x'],
    ['--device'],
    ['--device', '-e'],
    ['--device=emulator-5554'],
    ['other-flow.yml'],
    ['--'],
    ['--debug-output', '/tmp/x'],
  ]) {
    assert.throws(() => maestroArgs(bad), /maestro-branch-sign-in: (argument|--device)/, JSON.stringify(bad));
    let spawned = false;
    assert.throws(() => maestroMain(['free', ...bad], { env: prodEnv(), spawnImpl: () => { spawned = true; }, writeRecord: false }), /maestro-branch-sign-in: (argument|--device)/);
    assert.equal(spawned, false);
  }
  assert.throws(() => maestroMain(['admin'], { env: env(), spawnImpl: () => {}, writeRecord: false }), /tier must be/);
});
