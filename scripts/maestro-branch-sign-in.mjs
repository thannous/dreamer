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
import os from 'node:os';
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
export function runRecord({ tier, target, appId, appIdFromEnv = false, deviceArgs = [], git = (args) => execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' }).trim() }) {
  return {
    kind: 'branch-e2e-mobile-sign-in (dev loop, not release evidence)',
    sourceRevision: git(['rev-parse', 'HEAD']),
    dirty: Boolean(git(['status', '--porcelain'])),
    backend: `supabase branch ref ${target.ref}`,
    appId,
    tier,
    flow: FLOW,
    rerunCommand: `${appIdFromEnv ? `APP_ID=${appId} ` : ''}npm run test:e2e:branch:mobile -- ${[tier, ...deviceArgs].join(' ')}`,
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

export function finishRecord(result, file) {
  if (!file || !fs.existsSync(file)) return null;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.outcome = outcomeOf(result);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export const RESULTS_DIR = path.join(ROOT_DIR, 'test-results', 'e2e-branch-mobile');

// One record and one Maestro output folder per run, so concurrent runs on two
// devices never share or overwrite a file.
export function runPaths({ resultsDir = RESULTS_DIR, now = new Date(), pid = process.pid } = {}) {
  const id = `run-${now.toISOString().replace(/[:.]/g, '-')}-${pid}`;
  return { id, recordFile: path.join(resultsDir, `${id}.json`), outputDir: path.join(resultsDir, id) };
}

// Maestro 2.10.0 writes the evaluated inputText (the password) and its env
// into maestro.log and commands-*.json, under --debug-output and under
// ~/.maestro/tests/<stamp>/. It has no redaction option in the version this
// repo documents (inputText `redact` is still an upstream PR), so every run
// scrubs the exact password, raw and JSON-escaped, from the files it wrote.
export const MAESTRO_TESTS_DIR = (home = os.homedir()) => path.join(home, '.maestro', 'tests');

export function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

function secretForms(secret) {
  const json = JSON.stringify(secret).slice(1, -1);
  return [...new Set([secret, json, json.replace(/\//g, '\\/'), encodeURIComponent(secret)])].filter(Boolean);
}

export function scrubSecret(roots, secret) {
  if (!secret) return 0;
  const forms = secretForms(secret).map((form) => Buffer.from(form));
  const marker = Buffer.from('[redacted]');
  let changed = 0;
  const visit = (file) => {
    let stat;
    try {
      stat = fs.lstatSync(file);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file)) visit(path.join(file, name));
      return;
    }
    if (!stat.isFile()) return;
    let data = fs.readFileSync(file);
    let hit = false;
    for (const form of forms) {
      let index = data.indexOf(form);
      while (index !== -1) {
        data = Buffer.concat([data.subarray(0, index), marker, data.subarray(index + form.length)]);
        hit = true;
        index = data.indexOf(form, index + marker.length);
      }
    }
    if (hit) {
      fs.writeFileSync(file, data);
      changed += 1;
    }
  };
  for (const root of roots) visit(root);
  return changed;
}

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

// After the guard: per-run record, Maestro with its own --debug-output folder,
// and a finalize() that records the outcome and scrubs the password from that
// folder and from every ~/.maestro/tests/<stamp>/ the run created.
export function startRun({ tier, target, childEnv, deviceArgs = [], spawnImpl = spawn, writeRecord = true, paths = runPaths(), home = os.homedir() }) {
  const password = childEnv.MAESTRO_E2E_PASSWORD;
  const maestroTests = MAESTRO_TESTS_DIR(home);
  const before = new Set(listDirs(maestroTests));
  if (writeRecord) {
    fs.mkdirSync(paths.outputDir, { recursive: true });
    const record = runRecord({ tier, target, appId: childEnv.APP_ID || 'com.tanuki75.noctalia', appIdFromEnv: Boolean(childEnv.APP_ID), deviceArgs });
    fs.writeFileSync(paths.recordFile, `${JSON.stringify({ ...record, maestroOutput: path.relative(ROOT_DIR, paths.outputDir) }, null, 2)}\n`);
  }
  let finalized = false;
  // Idempotent and synchronous: safe from exit, error, signal and
  // process 'exit' handlers alike.
  const finalize = (result) => {
    if (finalized) return;
    finalized = true;
    try {
      if (writeRecord) finishRecord(result, paths.recordFile);
    } finally {
      const fresh = listDirs(maestroTests).filter((dir) => !before.has(dir));
      scrubSecret([paths.outputDir, ...fresh], password);
    }
  };
  let child;
  try {
    child = spawnImpl('maestro', [...deviceArgs, 'test', '--debug-output', paths.outputDir, FLOW], { cwd: ROOT_DIR, stdio: 'inherit', env: childEnv });
  } catch (error) {
    finalize({ error });
    throw error;
  }
  return { child, finalize, paths };
}

export function main(argv = process.argv.slice(2), {
  env = readTestEnv(),
  spawnImpl = spawn,
  writeRecord = true,
  paths = runPaths(),
  home = os.homedir(),
} = {}) {
  const [tier = 'free', ...rest] = argv;
  if (!E2E_TIERS.includes(tier)) throw new Error(`maestro-branch-sign-in: tier must be one of ${E2E_TIERS.join(', ')}`);
  const deviceArgs = maestroArgs(rest);
  // APP_ID selects the package (flow headers) and goes into the rerun command.
  if (process.env.APP_ID !== undefined && !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(process.env.APP_ID)) {
    throw new Error('maestro-branch-sign-in: APP_ID must be an Android package name (e.g. com.tanuki75.noctalia).');
  }
  const target = assertTestSupabaseTarget(env);
  const childEnv = maestroEnv(tier, env);
  return startRun({ tier, target, childEnv, deviceArgs, spawnImpl, writeRecord, paths, home });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { child, finalize } = main();
    // Last resort if the wrapper exits another way.
    process.on('exit', () => finalize({ code: null, signal: 'wrapper-exit' }));
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.on(signal, () => {
        // Let Maestro stop; its exit handler records the outcome and scrubs.
        if (child.exitCode === null && child.signalCode === null) child.kill(signal);
        setTimeout(() => {
          finalize({ code: null, signal });
          process.exit(1);
        }, 10_000).unref();
      });
    }
    child.on('exit', (code, signal) => {
      finalize({ code, signal });
      process.exit(code ?? (signal ? 1 : 0));
    });
    child.on('error', (error) => {
      finalize({ error });
      console.error(`maestro-branch-sign-in: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
