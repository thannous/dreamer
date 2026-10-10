// npm run test:e2e:branch:mobile -- <free|premium>: runs
// maestro/e2e-account-sign-in.yml with the credentials of one shared test
// account. The values come from .env.test.local through the guard's own loader
// (no shell expansion), the guard refuses production and unlisted projects,
// and the email is built from E2E_ACCOUNT_DOMAIN. Maestro gets them only as
// MAESTRO_E2E_EMAIL / MAESTRO_E2E_PASSWORD in its environment (never on the
// command line), and no other E2E_* value. Metro must already run in another
// terminal: node scripts/start-branch-e2e.mjs. No request is made here.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_TIERS, accountEmail, assertTestSupabaseTarget, readTestEnv } from './test-supabase-guard.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FLOW = 'maestro/e2e-account-sign-in.yml';

export function maestroEnv(tier, env, base = process.env) {
  if (!E2E_TIERS.includes(tier)) throw new Error(`maestro-branch-sign-in: tier must be one of ${E2E_TIERS.join(', ')}`);
  const password = env[`E2E_${tier.toUpperCase()}_PASSWORD`];
  if (!password) throw new Error(`maestro-branch-sign-in: E2E_${tier.toUpperCase()}_PASSWORD is not set in .env.test.local.`);
  const child = {};
  for (const [name, value] of Object.entries(base)) {
    if (!name.startsWith('E2E_') && !name.startsWith('MAESTRO_E2E_')) child[name] = value;
  }
  return { ...child, MAESTRO_E2E_EMAIL: accountEmail(tier, env.E2E_ACCOUNT_DOMAIN), MAESTRO_E2E_PASSWORD: password };
}

export function main(argv = process.argv.slice(2), { env = readTestEnv(), spawnImpl = spawn } = {}) {
  const [tier = 'free', ...rest] = argv;
  assertTestSupabaseTarget(env);
  const childEnv = maestroEnv(tier, env);
  return spawnImpl('maestro', ['test', ...rest, FLOW], { cwd: ROOT_DIR, stdio: 'inherit', env: childEnv });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const child = main();
    child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
    child.on('error', (error) => {
      console.error(`maestro-branch-sign-in: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
