import { createRequire } from 'node:module';

// Shared JS guards remain the runtime authority, including an empty allowlist.
const require = createRequire(import.meta.url);
export const { assertTestSupabaseTarget, readTestEnv, FORBIDDEN_PROJECT_REFS } = require('../../scripts/test-supabase-guard.mjs') as {
  assertTestSupabaseTarget: (env: Record<string, string | undefined>) => { ref: string; url: string };
  readTestEnv: () => Record<string, string | undefined>;
  FORBIDDEN_PROJECT_REFS: readonly string[];
};
export const { BRANCH_WEB_PORT } = require('../../scripts/test-auth-setup.mjs') as { BRANCH_WEB_PORT: number };
