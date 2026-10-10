// npm run test:e2e:branch:mobile -- <free|premium>: runs
// maestro/e2e-account-sign-in.yml with the credentials of one shared test
// account. The values come from .env.test.local through the guard's own loader
// (no shell expansion), the guard refuses production and unlisted projects,
// and the email is built from E2E_ACCOUNT_DOMAIN. Maestro gets them only as
// MAESTRO_E2E_EMAIL / MAESTRO_E2E_PASSWORD in its environment (never on the
// command line), and no other E2E_* value. Metro must already run in another
// terminal: node scripts/start-branch-e2e.mjs. No request is made here.
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { E2E_TIERS, accountEmail, assertTestSupabaseTarget, readTestEnv } from './test-supabase-guard.mjs';
import { PASSWORD_PATTERN } from './test-seed-users.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FLOW = 'maestro/e2e-account-sign-in.yml';

export function maestroEnv(tier, env, base = process.env) {
  if (!E2E_TIERS.includes(tier)) throw new Error(`maestro-branch-sign-in: tier must be one of ${E2E_TIERS.join(', ')}`);
  const password = env[`E2E_${tier.toUpperCase()}_PASSWORD`];
  if (!password) throw new Error(`maestro-branch-sign-in: E2E_${tier.toUpperCase()}_PASSWORD is not set in .env.test.local.`);
  if (!PASSWORD_PATTERN.test(password)) {
    throw new Error(`maestro-branch-sign-in: E2E_${tier.toUpperCase()}_PASSWORD must use printable ASCII without spaces; Maestro cannot type other characters on Android.`);
  }
  const child = {};
  for (const [name, value] of Object.entries(base)) {
    if (!name.startsWith('E2E_') && !name.startsWith('MAESTRO_E2E_')) child[name] = value;
  }
  return { ...child, MAESTRO_E2E_EMAIL: accountEmail(tier, env.E2E_ACCOUNT_DOMAIN), MAESTRO_E2E_PASSWORD: password };
}

// What this run was: written next to the Maestro output before it starts.
// It is a dev-loop record (source, backend, app id, tier), not release
// qualification evidence; the installed build is not inspected here.
export function runRecord({ tier, target, appId, git = (args) => execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' }).trim() }) {
  return {
    kind: 'branch-e2e-mobile-sign-in (dev loop, not release evidence)',
    sourceRevision: git(['rev-parse', 'HEAD']),
    dirty: Boolean(git(['status', '--porcelain'])),
    backend: `supabase branch ref ${target.ref}`,
    appId,
    tier,
    flow: FLOW,
    rerunCommand: `npm run test:e2e:branch:mobile -- ${tier}`,
  };
}

export const RECORD_FILE = path.join(ROOT_DIR, 'test-results', 'e2e-branch-mobile', 'run.json');

export function main(argv = process.argv.slice(2), { env = readTestEnv(), spawnImpl = spawn, writeRecord = true } = {}) {
  const [tier = 'free', ...rest] = argv;
  const target = assertTestSupabaseTarget(env);
  const childEnv = maestroEnv(tier, env);
  if (writeRecord) {
    fs.mkdirSync(path.dirname(RECORD_FILE), { recursive: true });
    const record = runRecord({ tier, target, appId: childEnv.APP_ID || 'com.tanuki75.noctalia' });
    fs.writeFileSync(RECORD_FILE, `${JSON.stringify(record, null, 2)}\n`);
  }
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
