import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTestEnv, runGuarded } from './test-supabase-guard.mjs';
import { readAuthSecrets, AUTH_DIR, BRANCH_WEB_ORIGIN } from './test-auth-setup.mjs';
import { withPersistentAccounts } from './lib/persistent-qa.mjs';

export async function withPersistentQaRun(body, { env = readTestEnv(), fetch = globalThis.fetch } = {}) {
  // The guard runs before credentials are read and before any network action.
  return runGuarded(env, context => withPersistentAccounts(context, {
    ...readAuthSecrets(env), authDir: AUTH_DIR, origin: BRANCH_WEB_ORIGIN,
    ids: { free: env.E2E_FREE_USER_ID, premium: env.E2E_PREMIUM_USER_ID },
  }, body), { fetch });
}

export async function main() {
  return withPersistentQaRun(async () => {
    console.log('[persistent-qa] Health, pinned identities, roles, exclusive leases and run-scoped fixture writes verified; cleanup follows.');
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Persistent QA preflight failed; no permanent availability is claimed. See doc_web_interne/docs/test-login.md.'); process.exitCode = 1; });
}
