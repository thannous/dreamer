// npm run test:seed-users: create missing dedicated QA accounts, reuse existing
// identities without password/data/entitlement resets. Not called by E2E runs.
// Owner-approved provisioning only, on
// the allowlisted test Supabase branch (doc_web_interne/docs/test-login.md).
// Everything goes through runGuarded. Existing identities, passwords, dreams,
// quota, images, sync receipts and subscriptions are never reset. Only a missing
// dedicated QA identity is created and assigned its initial server-owned tier.
// Normal QA runs do not call this provisioning command or use a service key.
import path from 'node:path';
import { randomUUID as nodeRandomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readTestEnv, runGuarded } from './test-supabase-guard.mjs';

const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const MIN_PASSWORD_LENGTH = 12;
// Printable ASCII without spaces: Android text input from a test driver
// (adb input text) cannot type Unicode, so a fixture password must stay
// enterable by the future native sign-in journey too.
export const PASSWORD_PATTERN = /^[\x21-\x7E]+$/;

export const TIER_STATE = Object.freeze({
  free: { p_tier: 'free', p_is_active: false },
  premium: { p_tier: 'plus', p_is_active: true },
});

export function readSeedSecrets(env) {
  const secrets = {
    serviceKey: env.E2E_SUPABASE_SERVICE_ROLE_KEY,
    passwords: { free: env.E2E_FREE_PASSWORD, premium: env.E2E_PREMIUM_PASSWORD },
  };
  if (!secrets.serviceKey) throw new Error('test-seed-users: E2E_SUPABASE_SERVICE_ROLE_KEY is not set. Nothing was sent.');
  for (const [tier, password] of Object.entries(secrets.passwords)) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`test-seed-users: E2E_${tier.toUpperCase()}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. Nothing was sent.`);
    }
    if (!PASSWORD_PATTERN.test(password)) {
      throw new Error(`test-seed-users: E2E_${tier.toUpperCase()}_PASSWORD must use printable ASCII without spaces (Android test drivers cannot type other characters). Nothing was sent.`);
    }
  }
  return secrets;
}

// New publishable/secret keys go on the apikey header only (Supabase API keys
// guide, "Known limitations"); legacy anon/service_role JWTs also go on
// Authorization: Bearer, as supabase-js sends them.
export function keyHeaders(key) {
  return String(key).startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

// One request against the guarded target. The URL is always built from
// target.url; the key headers follow keyHeaders.
async function call(fetch, target, key, method, pathname, body, extraHeaders = {}) {
  let response;
  try { response = await fetch(`${target.url}${pathname}`, {
    method,
    headers: { ...keyHeaders(key), 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  }); } catch { throw new Error('test-seed-users: request unavailable.'); }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`test-seed-users: ${method} ${pathname.split('?')[0]} failed (${response.status}): response omitted`);
  }
  try { return text ? JSON.parse(text) : null; } catch { throw new Error('test-seed-users: invalid response.'); }
}

async function findUser(fetch, target, key, email) {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await call(fetch, target, key, 'GET', `/auth/v1/admin/users?page=${page}&per_page=${PAGE_SIZE}`, undefined);
    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((user) => String(user.email).toLowerCase() === email);
    if (found) return found;
    if (users.length < PAGE_SIZE) return null;
  }
  throw new Error(`test-seed-users: more than ${PAGE_SIZE * MAX_PAGES} users on the test branch; refusing to guess.`);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function makeSeedAction(secrets, { log = console.log, randomUUID = nodeRandomUUID } = {}) {
  const key = secrets.serviceKey;
  return async ({ target, accounts, fetch }) => {
    const results = [];
    for (const { tier, email } of accounts) {
      const password = secrets.passwords[tier];
      const existing = await findUser(fetch, target, key, email);
      if (existing) {
        if (!UUID_PATTERN.test(existing.id)) throw new Error('test-seed-users: non-UUID existing QA identity refused.');
        log(`[test-seed-users] ${tier}: existing identity retained; no password, data or entitlement change.`);
        results.push({ tier, email, id: existing.id, action: 'reused' });
        continue;
      }
      const user = await call(fetch, target, key, 'POST', '/auth/v1/admin/users', { email, password, email_confirm: true });
      const id = user?.id ?? existing?.id;
      if (!UUID_PATTERN.test(id ?? '') || String(user?.email ?? email).toLowerCase() !== email) {
        throw new Error(`test-seed-users: the admin API did not return the ${tier} test account.`);
      }
      await call(fetch, target, key, 'POST', '/rest/v1/rpc/apply_subscription_state_update', {
        p_user_id: id,
        ...TIER_STATE[tier],
        p_source: 'e2e-seed',
        p_source_event_id: randomUUID(),
      });
      const action = 'created';
      log(`[test-seed-users] ${tier}: dedicated QA identity created; data retained.`);
      results.push({ tier, email, id, action });
    }
    return results;
  };
}

export async function main({ env = readTestEnv(), fetch = globalThis.fetch, log = console.log } = {}) {
  const secrets = readSeedSecrets(env);
  return runGuarded(env, makeSeedAction(secrets, { log }), { fetch });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
