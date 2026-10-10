// npm run test:auth-setup: log the two shared test accounts in on the
// allowlisted test Supabase branch with the password grant (no Google, OTP or
// captcha) and write one Playwright storageState per account to
// .auth/<tier>.json (gitignored, mode 0600). Everything goes through
// runGuarded. The state is what the web app's Supabase client reads: the
// session JSON under localStorage key sb-<ref>-auth-token (supabase-js default
// storage key; lib/supabase.ts sets no custom key or storage on web), for the
// origin of playwright.branch.config.ts. It never prints a token or password.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTestEnv, runGuarded } from './test-supabase-guard.mjs';
import { keyHeaders } from './test-seed-users.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AUTH_DIR = path.join(ROOT_DIR, '.auth');
// The Expo web server of playwright.branch.config.ts.
export const BRANCH_WEB_PORT = 8087;
export const BRANCH_WEB_ORIGIN = `http://127.0.0.1:${BRANCH_WEB_PORT}`;

export const storageKey = (ref) => `sb-${ref}-auth-token`;
export const authFile = (tier, dir = AUTH_DIR) => path.join(dir, `${tier}.json`);

export function readAuthSecrets(env) {
  const secrets = { anonKey: env.E2E_SUPABASE_ANON_KEY, passwords: { free: env.E2E_FREE_PASSWORD, premium: env.E2E_PREMIUM_PASSWORD } };
  if (!secrets.anonKey) throw new Error('test-auth-setup: E2E_SUPABASE_ANON_KEY is not set. Nothing was sent.');
  for (const [tier, password] of Object.entries(secrets.passwords)) {
    if (!password) throw new Error(`test-auth-setup: E2E_${tier.toUpperCase()}_PASSWORD is not set. Nothing was sent.`);
  }
  return secrets;
}

export function storageStateFor(ref, session, origin = BRANCH_WEB_ORIGIN) {
  return { cookies: [], origins: [{ origin, localStorage: [{ name: storageKey(ref), value: JSON.stringify(session) }] }] };
}

export function makeAuthAction(secrets, { dir = AUTH_DIR, log = console.log, now = () => Date.now() } = {}) {
  return async ({ target, accounts, fetch }) => {
    const written = [];
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    for (const { tier, email } of accounts) {
      const response = await fetch(`${target.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { ...keyHeaders(secrets.anonKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: secrets.passwords[tier] }),
      });
      const text = await response.text();
      if (!response.ok) {
        // The auth error body carries no secret; it is still not printed whole.
        let reason = '';
        try {
          const parsed = JSON.parse(text);
          reason = String(parsed.error_code ?? parsed.error ?? parsed.code ?? '').slice(0, 80);
        } catch {
          reason = '';
        }
        throw new Error(`test-auth-setup: password login failed for ${email} (${response.status}${reason ? `, ${reason}` : ''}). Run npm run test:seed-users first.`);
      }
      const session = JSON.parse(text);
      if (!session.access_token || !session.refresh_token || !session.user?.id) {
        throw new Error(`test-auth-setup: the token endpoint returned no session for ${email}.`);
      }
      if (String(session.user.email ?? '').toLowerCase() !== email) {
        throw new Error(`test-auth-setup: the session returned for ${email} belongs to another account.`);
      }
      if (!session.expires_at && session.expires_in) session.expires_at = Math.floor(now() / 1000) + Number(session.expires_in);
      const file = authFile(tier, dir);
      fs.writeFileSync(file, `${JSON.stringify(storageStateFor(target.ref, session), null, 2)}\n`, { mode: 0o600 });
      fs.chmodSync(file, 0o600);
      log(`[test-auth-setup] ${email}: session written to ${path.relative(ROOT_DIR, file) || file}.`);
      written.push({ tier, email, file });
    }
    return written;
  };
}

export async function main({ env = readTestEnv(), fetch = globalThis.fetch, log = console.log, dir = AUTH_DIR } = {}) {
  const secrets = readAuthSecrets(env);
  return runGuarded(env, makeAuthAction(secrets, { dir, log }), { fetch });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
