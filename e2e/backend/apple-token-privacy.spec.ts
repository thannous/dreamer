import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { test, expect, admin, client } from './fixtures';

const { Client } = require('pg');

const status = JSON.parse(readFileSync(process.env.E2E_BACKEND_STATUS_FILE!, 'utf8'));

function expectClientSafe(value: unknown, marker: string) {
  // Assert booleans so a failing report never dumps real session credentials.
  const encoded = JSON.stringify(value);
  expect(encoded.includes(marker)).toBe(false);
  expect(encoded.includes('apple_refresh_token')).toBe(false);
}
function jwtClaims(token: string) { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); }
async function expectCurrentUserSafe(owner: ReturnType<typeof client>, marker: string) {
  const current = await owner.auth.getUser();
  expect(current.error).toBeNull();
  expect(current.data.user).not.toBeNull();
  expectClientSafe(current.data, marker);
}

// The canonical runner owns and guards this real Auth/Postgres/PostgREST stack.
// Apple's exchange/revocation alone is synthetic: no provider account or payment.
test('Apple provider credentials stay private through Auth, refresh, API storage and account deletion', async ({ request }) => {
  const marker = `synthetic-apple-${randomUUID()}`;
  const server = spawn('deno', ['run', '--frozen', '--allow-env',
    `--allow-read=${process.env.E2E_BACKEND_STATUS_FILE}`, '--allow-net=127.0.0.1',
    'api/evaluation/apple-token-privacy-server.ts'], {
    cwd: path.resolve('supabase/functions'),
    env: { ...process.env, APPLE_PRIVACY_SYNTHETIC_TOKEN: marker }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr: string[] = [];
  server.stderr.on('data', chunk => stderr.push(String(chunk)));
  const output = createInterface({ input: server.stdout });
  const db = new Client({ connectionString: status.DB_URL });
  const created: string[] = [];
  try {
    const apiUrl = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Local Apple API did not start')), 20000);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', () => { clearTimeout(timer); reject(new Error('Local Apple API exited before readiness')); });
      output.on('line', line => {
        const match = /^APPLE_AUTH_TEST_READY:(\d+)$/.exec(line);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}/api`); }
      });
    });
    const email = `apple-privacy-${randomUUID()}@example.test`;
    const password = `Local!${randomUUID()}`;
    // Exercise a legacy admin INSERT before any sign-in response can be issued.
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { apple_refresh_token: marker, fixture: 'retained' } });
    expect(user.error).toBeNull();
    const ownerId = user.data.user!.id;
    created.push(ownerId);
    // GoTrue's service-only admin response can retain its input object. It must
    // never be forwarded to an app; check a fresh read and public Auth below.
    const persisted = await admin.auth.admin.getUserById(ownerId);
    expect(persisted.error).toBeNull();
    expectClientSafe(persisted.data, marker);
    expect(persisted.data.user!.app_metadata.fixture).toBe('retained');
    const stored = await admin.rpc('read_apple_refresh_token', { p_user_id: ownerId });
    expect(stored.error).toBeNull();
    expect(stored.data === marker).toBe(true);

    const owner = client();
    const login = await owner.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull();
    expectClientSafe(login.data, marker);
    expectClientSafe(jwtClaims(login.data.session!.access_token), marker);
    const other = await admin.auth.admin.createUser({ email: `apple-other-${randomUUID()}@example.test`, password, email_confirm: true });
    expect(other.error).toBeNull();
    created.push(other.data.user!.id);
    const stranger = client();
    expect((await stranger.auth.signInWithPassword({ email: other.data.user!.email!, password })).error).toBeNull();
    for (const caller of [client(), owner, stranger]) {
      const read = await caller.rpc('read_apple_refresh_token', { p_user_id: ownerId });
      expect([401, 403]).toContain(read.status);
      expect(read.error?.code).toBe('42501');
      const write = await caller.rpc('store_apple_refresh_token', { p_user_id: ownerId, p_refresh_token: 'forged' });
      expect([401, 403]).toContain(write.status);
      expect(write.error?.code).toBe('42501');
      const privateTable = await caller.schema('apple_auth_private').from('refresh_tokens').select('*');
      expect(privateTable.status).toBe(406);
      expect(privateTable.error?.code).toBe('PGRST106');
      const publicTable = await caller.from('refresh_tokens').select('*');
      expect(publicTable.status).toBe(404);
      expect(publicTable.error?.code).toBe('PGRST205');
    }
    const legacy = await admin.auth.admin.updateUserById(ownerId, { app_metadata: { apple_refresh_token: marker } });
    expect(legacy.error).toBeNull();
    await expectCurrentUserSafe(owner, marker);
    const refreshed = await owner.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expectClientSafe(refreshed.data, marker);
    expectClientSafe(jwtClaims(refreshed.data.session!.access_token), marker);
    const headers = { Authorization: `Bearer ${refreshed.data.session!.access_token}` };
    expect((await request.post(`${apiUrl}/auth/apple-token`, { data: { authorizationCode: 'fixture' } })).status()).toBe(401);
    const saved = await request.post(`${apiUrl}/auth/apple-token`, { headers,
      data: { authorizationCode: 'fixture', userId: other.data.user!.id } });
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toEqual({ ok: true });
    expect((await admin.rpc('read_apple_refresh_token', { p_user_id: ownerId })).data === marker).toBe(true);
    const otherToken = await admin.rpc('read_apple_refresh_token', { p_user_id: other.data.user!.id });
    expect(otherToken.error).toBeNull();
    expect(otherToken.data).toBeNull();
    await expectCurrentUserSafe(owner, marker);
    const afterStore = await owner.auth.refreshSession();
    expect(afterStore.error).toBeNull();
    expectClientSafe(afterStore.data, marker);
    expectClientSafe(jwtClaims(afterStore.data.session!.access_token), marker);
    headers.Authorization = `Bearer ${afterStore.data.session!.access_token}`;
    const failed = await request.post(`${apiUrl}/auth/apple-token`, { headers, data: { authorizationCode: 'fail-provider' } });
    expect(failed.status()).toBe(503);
    expectClientSafe(await failed.json(), marker);
    expect(stderr.join('').includes(marker)).toBe(false);

    const advisors = execFileSync(path.resolve('node_modules/.bin/supabase'), [
      'db', 'advisors', '--db-url', status.DB_URL, '--type', 'security', '--fail-on', 'none', '--output-format', 'json',
    ], { encoding: 'utf8', env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SUPABASE_'))),
      SUPABASE_HOME: process.env.E2E_SUPABASE_HOME || path.resolve('test-results/backend-e2e-cli-home'),
      SUPABASE_EXPERIMENTAL_STACK: '1', DO_NOT_TRACK: '1',
    } });
    writeFileSync('test-results/apple-token-security-advisors.json', advisors, { mode: 0o600 });
    await db.connect();
    // Synthetic Apple identity exercises the real deletion consumer and FK cascade.
    const appleSubject = randomUUID();
    await db.query(`insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
      values ($1,$2,$3,$4,'apple',now(),now(),now())`, [randomUUID(), appleSubject, ownerId,
      { sub: appleSubject, email, email_verified: true }]);
    expect((await owner.auth.getUser()).error).toBeNull();
    expect((await admin.rpc('store_apple_refresh_token', { p_user_id: ownerId,
      p_refresh_token: `${marker}-provider-reject` })).error).toBeNull();
    const failedDeletion = await request.delete(`${apiUrl}/account`, { headers });
    expect(failedDeletion.status()).toBe(503);
    expect(await failedDeletion.json()).toEqual({ error: 'Apple token revocation failed' });
    expect((await admin.auth.admin.getUserById(ownerId)).error).toBeNull();
    expect((await request.post(`${apiUrl}/auth/apple-token`, { headers,
      data: { authorizationCode: 'fixture' } })).status()).toBe(200);
    const deleted = await request.delete(`${apiUrl}/account`, { headers });
    expect(deleted.status()).toBe(200);
    expect(await deleted.json()).toEqual({ deleted: true });
    const erased = await admin.rpc('read_apple_refresh_token', { p_user_id: ownerId });
    expect(erased.error).toBeNull();
    expect(erased.data).toBeNull();
    created.splice(created.indexOf(ownerId), 1);
  } finally {
    await db.end();
    for (const id of created) await admin.auth.admin.deleteUser(id);
    output.close();
    if (server.exitCode === null) { const closed = once(server, 'exit'); server.kill('SIGTERM'); await closed; }
  }
});
