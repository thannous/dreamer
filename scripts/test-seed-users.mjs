// npm run test:seed-users: create or reset the two shared test accounts on
// the allowlisted test Supabase branch (doc_web_interne/docs/test-login.md).
// Everything goes through runGuarded: production and unlisted projects are
// refused before any request, and only e2e+free@ / e2e+premium@<domain> are
// touched. Idempotent: an existing account gets its password reset, its dreams
// quota usage and HD credits deleted and its tier set again; a missing one is created.
// Premium mirrors the local backend fixture (e2e/backend/fixtures.ts): the
// service-role RPC apply_subscription_state_update with p_tier 'plus' and
// p_is_active true. Free is set back with p_tier 'free', p_is_active false.
// It never prints a key or a password.
import path from 'node:path';
import { createHash, randomUUID as nodeRandomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readTestEnv, runGuarded } from './test-supabase-guard.mjs';

const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const MIN_PASSWORD_LENGTH = 12;
// Printable ASCII without spaces: Maestro inputText cannot type Unicode on
// Android, so a fixture password must be enterable by the mobile flow too.
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
      throw new Error(`test-seed-users: E2E_${tier.toUpperCase()}_PASSWORD must use printable ASCII without spaces (Maestro cannot type other characters on Android). Nothing was sent.`);
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

function redact(text, secrets) {
  let out = String(text);
  for (const value of secrets) if (value) out = out.split(value).join('[redacted]');
  return out;
}

// One request against the guarded target. The URL is always built from
// target.url; the key headers follow keyHeaders.
async function call(fetch, target, key, method, pathname, body, secretValues, extraHeaders = {}) {
  const response = await fetch(`${target.url}${pathname}`, {
    method,
    headers: { ...keyHeaders(key), 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`test-seed-users: ${method} ${pathname.split('?')[0]} failed (${response.status}): ${redact(text.slice(0, 300), secretValues)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function findUser(fetch, target, key, email, secretValues) {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await call(fetch, target, key, 'GET', `/auth/v1/admin/users?page=${page}&per_page=${PAGE_SIZE}`, undefined, secretValues);
    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((user) => String(user.email).toLowerCase() === email);
    if (found) return found;
    if (users.length < PAGE_SIZE) return null;
  }
  throw new Error(`test-seed-users: more than ${PAGE_SIZE * MAX_PAGES} users on the test branch; refusing to guess.`);
}

// Generated images live under dream-images/<userId>/ (flat, see
// supabase/functions/api/services/storage.ts) with no FK cascade, like the
// account deletion route (routes/account.ts) handles. List then remove, page by
// page, strictly under that one user's prefix.
export const IMAGE_BUCKET = 'dream-images';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORAGE_PAGE_SIZE = 100;
const STORAGE_MAX_PAGES = 100;

async function clearUserImages(fetch, target, key, userId, secretValues) {
  if (!UUID_PATTERN.test(userId)) throw new Error('test-seed-users: refusing to clear Storage for a non-UUID user id.');
  const prefix = `${userId}/`;
  let removed = 0;
  for (let page = 0; page < STORAGE_MAX_PAGES; page += 1) {
    const entries = await call(fetch, target, key, 'POST', `/storage/v1/object/list/${IMAGE_BUCKET}`, {
      prefix,
      limit: STORAGE_PAGE_SIZE,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }, secretValues);
    // Folder placeholders have a null id; names never leave the prefix.
    const paths = (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry?.id && typeof entry.name === 'string' && entry.name && !entry.name.includes('/') && entry.name !== '..' && entry.name !== '.')
      .map((entry) => `${prefix}${entry.name}`);
    if (paths.length === 0) return removed;
    await call(fetch, target, key, 'DELETE', `/storage/v1/object/${IMAGE_BUCKET}`, { prefixes: paths }, secretValues);
    removed += paths.length;
  }
  throw new Error(`test-seed-users: more than ${STORAGE_PAGE_SIZE * STORAGE_MAX_PAGES} images for one test account; refusing to continue.`);
}

// public.ai_rate_limit_buckets keys rows by actor_hash = sha256("user:<id>")
// (supabase/functions/api/services/aiAdmission.ts hashAiActor), next to
// 'global' rows that must stay.
export function aiActorHash(userId) {
  return createHash('sha256').update(`user:${userId}`).digest('hex');
}

export function makeSeedAction(secrets, { log = console.log, randomUUID = nodeRandomUUID } = {}) {
  const key = secrets.serviceKey;
  const secretValues = [key, ...Object.values(secrets.passwords)];
  return async ({ target, accounts, fetch }) => {
    const results = [];
    for (const { tier, email } of accounts) {
      const password = secrets.passwords[tier];
      const existing = await findUser(fetch, target, key, email, secretValues);
      let user;
      if (existing) {
        user = await call(fetch, target, key, 'PUT', `/auth/v1/admin/users/${existing.id}`, { password, email_confirm: true }, secretValues);
      } else {
        user = await call(fetch, target, key, 'POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, secretValues);
      }
      const id = user?.id ?? existing?.id;
      if (!id || String(user?.email ?? email).toLowerCase() !== email) {
        throw new Error(`test-seed-users: the admin API did not return the ${tier} test account.`);
      }
      await call(fetch, target, key, 'DELETE', `/rest/v1/dreams?user_id=eq.${encodeURIComponent(id)}`, undefined, secretValues, { Prefer: 'return=minimal' });
      // Quota rows are counted by user and month even when the dream is gone
      // (no cascade), so a reset clears them too.
      await call(fetch, target, key, 'DELETE', `/rest/v1/quota_usage?user_id=eq.${encodeURIComponent(id)}`, undefined, secretValues, { Prefer: 'return=minimal' });
      // HD illustration credits (public.hd_image_credits, migration
      // 20260916185856) are counted per user and month with no link to dreams.
      await call(fetch, target, key, 'DELETE', `/rest/v1/hd_image_credits?user_id=eq.${encodeURIComponent(id)}`, undefined, secretValues, { Prefer: 'return=minimal' });
      // Sync receipts (public.dream_sync_receipts, migration 20260316130000)
      // are linked to the user only: a kept receipt would answer a replayed
      // client_request_id with the deleted dream instead of recreating it.
      await call(fetch, target, key, 'DELETE', `/rest/v1/dream_sync_receipts?user_id=eq.${encodeURIComponent(id)}`, undefined, secretValues, { Prefer: 'return=minimal' });
      // AI burst buckets of this account only (never the 'global' rows).
      const actorHash = aiActorHash(id);
      if (!/^[a-f0-9]{64}$/.test(actorHash)) throw new Error('test-seed-users: unexpected AI actor hash.');
      await call(fetch, target, key, 'DELETE', `/rest/v1/ai_rate_limit_buckets?actor_hash=eq.${actorHash}`, undefined, secretValues, { Prefer: 'return=minimal' });
      const images = await clearUserImages(fetch, target, key, id, secretValues);
      await call(fetch, target, key, 'POST', '/rest/v1/rpc/apply_subscription_state_update', {
        p_user_id: id,
        ...TIER_STATE[tier],
        p_source: 'e2e-seed',
        p_source_event_id: randomUUID(),
      }, secretValues);
      const action = existing ? 'reset' : 'created';
      log(`[test-seed-users] ${email}: ${action}, tier ${TIER_STATE[tier].p_tier}, dreams, quota usage, HD credits, sync receipts, AI rate-limit buckets and ${images} image(s) cleared (${target.url}).`);
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
