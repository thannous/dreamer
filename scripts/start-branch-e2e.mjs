// Starts Expo (web via playwright.branch.config.ts, or Metro for a dev client
// driven by Maestro) against the allowlisted test Supabase branch only. The
// target comes from the guard (production and unlisted refs are refused); the
// app gets that URL, the branch anon key and the branch functions URL, with
// mock mode off. Process env wins over .env files in Expo, so a local
// .env.local pointing at production cannot take over. No request is made here.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertKeyRole, assertTestSupabaseTarget, readTestEnv } from './test-supabase-guard.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// EXPO_PUBLIC_* values are inlined into the bundle, so only these feature
// flags pass through from the shell; every other EXPO_PUBLIC_* (endpoints,
// keys, RevenueCat, Google, Turnstile, mock and QA switches) is dropped and the
// Supabase ones are set below from the guarded target.
export const PASSTHROUGH_EXPO_PUBLIC = Object.freeze([
  'EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED',
  'EXPO_PUBLIC_ANALYTICS_DEBUG',
  'EXPO_PUBLIC_DEBUG_CHAT',
  'EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED',
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED',
  'EXPO_PUBLIC_PERFORMANCE_TRACING',
  'EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED',
  'EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED',
]);

// target must come from assertTestSupabaseTarget (main does that first).
export function branchAppEnv(target, env, base = process.env) {
  if (!env.E2E_SUPABASE_ANON_KEY) throw new Error('start-branch-e2e: E2E_SUPABASE_ANON_KEY is not set.');
  // Checked again here: this value is bundled into the app.
  assertKeyRole('E2E_SUPABASE_ANON_KEY', env.E2E_SUPABASE_ANON_KEY);
  const child = {};
  // Never hand the admin key or the test passwords to the app or Metro; keep
  // RevenueCat out (with a key it would reconcile the seeded tier to free).
  for (const [name, value] of Object.entries(base)) {
    if (name.startsWith('E2E_')) continue;
    // Product selectors (NOCTALIA_APP_VARIANT, NOCTALIA_DREAMER_QA_BUILD, ...)
    // are dropped: this runtime is Dreamer only, and a lone native Lucid
    // marker without its EXPO_PUBLIC_ twin would make app.config.ts refuse.
    if (name.startsWith('NOCTALIA_')) continue;
    if (name.startsWith('EXPO_PUBLIC_') && !PASSTHROUGH_EXPO_PUBLIC.includes(name)) continue;
    child[name] = value;
  }
  return {
    ...child,
    EXPO_PUBLIC_SUPABASE_URL: target.url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: env.E2E_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: `https://${target.ref}.functions.supabase.co/api`,
    // lib/http.ts would otherwise fall back to the production legacy JWT in
    // app.json (expo.extra.supabaseFunctionJwt). A legacy anon JWT has already
    // been checked by the guard to name this branch; a publishable key is used
    // as is (function calls may then answer 401, but never reach production
    // credentials).
    EXPO_PUBLIC_SUPABASE_FUNCTION_JWT: env.E2E_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_MOCK_MODE: 'false',
    // Like a --profile run: no .env or .env.local is mixed in.
    EXPO_NO_DOTENV: '1',
  };
}

// Marker for scripts/expo-safe-runner.js: when present (any value) the runner
// refuses --profile, forces EXPO_NO_DOTENV=1, accepts only `start`, and
// re-checks the final app env with the guard. It only adds restrictions.
export const BRANCH_GUARD_MARKER = 'NOCTALIA_BRANCH_E2E_GUARD';

const FLAG_ARGS = new Set(['--web', '--dev-client', '--clear', '--lan', '--localhost']);

// Only these Expo args pass; anything else (--profile, --profile=..., -p,
// positional args, `--`, unknown flags) is refused before anything starts.
export function parseBranchArgs(argv) {
  const out = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (FLAG_ARGS.has(arg)) {
      out.push(arg);
      continue;
    }
    if (arg === '--port') {
      const value = String(argv[index + 1] ?? '');
      const port = Number(value);
      if (!/^[0-9]{1,5}$/.test(value) || port < 1 || port > 65535) throw new Error('start-branch-e2e: --port needs a number from 1 to 65535.');
      out.push('--port', String(port));
      index += 1;
      continue;
    }
    throw new Error(`start-branch-e2e: argument "${arg}" is not allowed. Allowed: --web, --port <1-65535>, --dev-client, --clear, --lan, --localhost.`);
  }
  return out;
}

export const RUNNER = path.join(SCRIPT_DIR, 'expo-safe-runner.js');

// The exact runner command for an already guarded target.
export function branchCommand(args, target, env) {
  return {
    args: [RUNNER, 'start', ...args],
    env: { ...branchAppEnv(target, env), [BRANCH_GUARD_MARKER]: '1' },
  };
}

export function main(argv = process.argv.slice(2), { env = readTestEnv(), spawnImpl = spawn } = {}) {
  const args = parseBranchArgs(argv);
  const command = branchCommand(args, assertTestSupabaseTarget(env), env);
  return spawnImpl(process.execPath, command.args, { stdio: 'inherit', env: command.env });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const child = main();
    child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
