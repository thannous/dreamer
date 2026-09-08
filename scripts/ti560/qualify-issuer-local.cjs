'use strict';
// Opt-in real issuance only. Never starts/stops the existing stack or changes its configuration.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readLocalStatus } = require('../ti528/local-config.cjs');
const status = readLocalStatus(process.env.TI528_LOCAL_STATUS);
const original = 'supabase_auth_noctalia-ti528-disposable';
const network = 'supabase_network_noctalia-ti528-disposable';
const name = `ti560-auth-${randomUUID()}`;
const endpoint = 'http://127.0.0.1:55329';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
const config = JSON.parse(docker('inspect', original))[0];
assert.equal(config.Config.Labels['com.supabase.cli.project'], 'noctalia-ti528-disposable');
assert.equal(config.Config.Image, 'public.ecr.aws/supabase/gotrue:v2.189.0');
assert.ok(config.NetworkSettings.Networks[network]);
const environment = Object.fromEntries(config.Config.Env.map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const db = new URL(environment.GOTRUE_DB_DATABASE_URL);
assert.ok(['db', 'supabase_db_noctalia-ti528-disposable'].includes(db.hostname));
assert.equal(db.pathname, '/postgres');
assert.equal(environment.GOTRUE_API_PORT, '9999');
const privateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti560-issuer-'));
fs.chmodSync(privateDirectory, 0o700);
const envFile = path.join(privateDirectory, 'auth.env');
Object.assign(environment, { GOTRUE_OAUTH_SERVER_ENABLED: 'true', GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH: '/oauth/consent', GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION: 'false' });
assert.ok(Object.values(environment).every(value => !/[\r\n]/.test(value)));
fs.writeFileSync(envFile, Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
let container = false;
const cancellation = new AbortController();
const onSignal = () => cancellation.abort();
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);
const boundedSignal = (cleanup = false) => cleanup
  ? AbortSignal.timeout(10000)
  : AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]);
const users = [], clients = [];
async function request(route, { token, body, form, method = body || form ? 'POST' : 'GET', expected = 200, cleanup = false } = {}) {
  const response = await fetch(endpoint + route, { method, signal: boundedSignal(cleanup), redirect: 'manual', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? JSON.stringify(body) : form ? new URLSearchParams(form) : undefined });
  assert.equal(response.status, expected, `${method} ${route.split('?')[0]} status`);
  if (response.status >= 300 && response.status < 400) return response.headers.get('location');
  if (response.status === 204) return null;
  return response.json();
}
async function verify(token, userId, clientId) {
  const user = await request('/user', { token });
  assert.equal(user.id, userId);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, userId);
  assert.equal(claims.client_id, clientId);
  assert.equal(claims.aud, 'authenticated');
  assert.equal(claims.iss, environment.GOTRUE_JWT_ISSUER);
  // The existing gateway independently verifies the issuer token, not merely its decoded claims.
  const rest = await fetch(status.API_URL + '/rest/v1/dreams?select=id&limit=1', { signal: boundedSignal(), headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${token}` } });
  assert.equal(rest.status, 200);
}
(async () => {
  try {
    docker('create', '--name', name, '--network', network, '--publish', '127.0.0.1:55329:9999', '--env-file', envFile, config.Image, 'auth');
    container = true;
    cancellation.signal.throwIfAborted();
    docker('start', name);
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      cancellation.signal.throwIfAborted();
      try { healthy = (await fetch(endpoint + '/health', { signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(1000)]) })).ok; } catch { /* bounded startup */ }
      if (healthy) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(healthy, 'Auxiliary local Auth healthy');
    for (const product of ['journal', 'lucid']) {
      const redirect = `http://127.0.0.1:55328/${product}`;
      const client = await request('/admin/oauth/clients', { token: status.SERVICE_ROLE_KEY, body: { client_name: `TI560 ${product} ${randomUUID()}`, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'] }, expected: 201 });
      clients.push(client.client_id);
      assert.equal(client.client_type, 'public');
      assert.equal(client.token_endpoint_auth_method, 'none');
    }
    for (let i = 0; i < 2; i++) {
      const email = `ti560-${randomUUID()}@example.test`, password = randomUUID();
      const user = await request('/admin/users', { token: status.SERVICE_ROLE_KEY, body: { email, password, email_confirm: true } });
      users.push(user.id);
      const session = await request('/token?grant_type=password', { body: { email, password } });
      assert.equal(JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).client_id, undefined);
      for (let j = 0; j < clients.length; j++) {
        const clientId = clients[j], redirect = `http://127.0.0.1:55328/${j ? 'lucid' : 'journal'}`;
        const verifier = randomBytes(48).toString('base64url');
        const state = randomUUID();
        const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'email', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        const location = await request('/oauth/authorize?' + query, { expected: 302 });
        const authorizationId = new URL(location).searchParams.get('authorization_id');
        assert.ok(authorizationId);
        await request(`/oauth/authorizations/${authorizationId}`, { token: session.access_token });
        const consent = await request(`/oauth/authorizations/${authorizationId}/consent`, { token: session.access_token, body: { action: 'approve' } });
        const result = new URL(consent.redirect_url);
        assert.equal(result.searchParams.get('state'), state);
        assert.equal(result.origin + result.pathname, redirect);
        const issued = await request('/oauth/token', { form: { grant_type: 'authorization_code', client_id: clientId, code: result.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect } });
        await verify(issued.access_token, user.id, clientId);
        const refreshed = await request('/oauth/token', { form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: issued.refresh_token } });
        await verify(refreshed.access_token, user.id, clientId);
      }
    }
    console.log('PASS: real OAuth PKCE + refresh, two users x two public clients; Auth and existing Data API validate tokens. No isolation policy asserted.');
  } finally {
    const cleanupErrors = [];
    try {
      if (container) {
        for (const id of users) {
          try { await request(`/admin/users/${id}`, { token: status.SERVICE_ROLE_KEY, method: 'DELETE', cleanup: true }); } catch { cleanupErrors.push('user'); }
        }
        for (const id of clients) {
          try { await request(`/admin/oauth/clients/${id}`, { token: status.SERVICE_ROLE_KEY, method: 'DELETE', expected: 204, cleanup: true }); } catch { cleanupErrors.push('client'); }
        }
        try { docker('rm', '-f', name); } catch { cleanupErrors.push('container'); }
      }
    } finally {
      fs.rmSync(privateDirectory, { recursive: true });
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }
    assert.equal(cleanupErrors.length, 0, 'Owned synthetic fixture/container cleanup completed');
  }
})().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : 'Local issuer qualification failed; private credentials omitted.'); process.exitCode = 1; });
