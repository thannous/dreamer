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
    outcome: { status: 'running' },
  };
}

// Final outcome, written over the pre-run record when Maestro ends. Only an
// exit code 0 without a signal counts as passed; a record left at "running"
// means the wrapper itself was killed.
export function outcomeOf({ code = null, signal = null, error = null } = {}) {
  const status = error ? 'error' : code === 0 && !signal ? 'passed' : 'failed';
  return {
    status,
    exitCode: code,
    signal,
    ...(error ? { error: String(error.message ?? error) } : {}),
    finishedAt: new Date().toISOString(),
  };
}

export function finishRecord(result, file = RECORD_FILE) {
  if (!fs.existsSync(file)) return null;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.outcome = outcomeOf(result);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export const RECORD_FILE = path.join(ROOT_DIR, 'test-results', 'e2e-branch-mobile', 'run.json');

// Only `--device <id>` passes after the tier. Anything else (notably `-e` /
// `--env`, which would replace MAESTRO_E2E_EMAIL/PASSWORD inside the flow) is
// refused before the guard runs or Maestro starts.
export function maestroArgs(rest) {
  const out = [];
  for (let index = 0; index < rest.length; index += 1) {
    const arg = String(rest[index]);
    if (arg === '--device') {
      const value = String(rest[index + 1] ?? '');
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) throw new Error('maestro-branch-sign-in: --device needs an adb serial or device id.');
      out.push('--device', value);
      index += 1;
      continue;
    }
    throw new Error(`maestro-branch-sign-in: argument "${arg}" is not allowed. Usage: npm run test:e2e:branch:mobile -- <free|premium> [--device <id>].`);
  }
  return out;
}

export function main(argv = process.argv.slice(2), { env = readTestEnv(), spawnImpl = spawn, writeRecord = true } = {}) {
  const [tier = 'free', ...rest] = argv;
  if (!E2E_TIERS.includes(tier)) throw new Error(`maestro-branch-sign-in: tier must be one of ${E2E_TIERS.join(', ')}`);
  const deviceArgs = maestroArgs(rest);
  const target = assertTestSupabaseTarget(env);
  const childEnv = maestroEnv(tier, env);
  if (writeRecord) {
    fs.mkdirSync(path.dirname(RECORD_FILE), { recursive: true });
    const record = runRecord({ tier, target, appId: childEnv.APP_ID || 'com.tanuki75.noctalia' });
    fs.writeFileSync(RECORD_FILE, `${JSON.stringify(record, null, 2)}\n`);
  }
  return spawnImpl('maestro', [...deviceArgs, 'test', FLOW], { cwd: ROOT_DIR, stdio: 'inherit', env: childEnv });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const child = main();
    child.on('exit', (code, signal) => {
      finishRecord({ code, signal });
      process.exit(code ?? (signal ? 1 : 0));
    });
    child.on('error', (error) => {
      finishRecord({ error });
      console.error(`maestro-branch-sign-in: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
