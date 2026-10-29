/**
 * Pre-release bug bash of Dreamer web in mock mode.
 * Not part of verify:pr. verify:release runs the repro tests this step is
 * meant to leave behind (`npm run test:bugbash:repros`), which fail until the
 * bug is fixed. This script runs the explore charters. Each confirmed bug
 * must become a failing test under tools/e2e/tests/bugbash/, tagged bugbash.
 * Production Supabase refs and a mock-mode opt-out are refused before any
 * explore starts. There is no emulator here: web only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_KEYS, FORBIDDEN_PROJECT_REFS } from '../../scripts/test-supabase-guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

export const CHARTERS = [
  { slug: 'capture', agent: 'default', goal: 'Starting after onboarding on the dream capture screen of this local mock app, write a short dream and stay there. Report anything that blocks writing. Do not buy, subscribe, or leave the local origin.' },
  { slug: 'sauvegarde', agent: 'default', goal: 'Save one dream in this local mock app and find the same text again after a reload. Report a save that loses the story. Do not buy or subscribe.' },
  { slug: 'journal', agent: 'skeptic', goal: 'Open the journal in this local mock app, apply a filter, and check that the dreams on screen match the filter. Report a filter that hides the wrong dreams or loses the story. Do not buy or subscribe.' },
  { slug: 'paiement', agent: 'skeptic', goal: 'Open the Plus offer in this local mock app and inspect the monthly price. Do not complete a purchase. Report a price or a button that would leave the mock. Never call a real store.' },
  { slug: 'connexion', agent: 'default', goal: 'Open sign-in in this local mock app, choose a mock profile, and reach the capture screen signed in. Report a path that asks for a real account or leaves the local origin.' },
];

export function assertLocalMock(env) {
  if (env.EXPO_PUBLIC_MOCK_MODE === 'false') {
    throw new Error('Bug bash refuses EXPO_PUBLIC_MOCK_MODE=false. The app stays in mock mode.');
  }
  const values = Object.values(env).filter(value => typeof value === 'string');
  for (const ref of FORBIDDEN_PROJECT_REFS) {
    if (values.some(value => value.toLowerCase().includes(ref))) {
      throw new Error('Bug bash refuses the production Supabase project.');
    }
  }
  for (const key of FORBIDDEN_KEYS) {
    if (values.includes(key)) throw new Error('Bug bash refuses a production Supabase key.');
  }
}

export function mockEnv(base = process.env) {
  const env = {
    ...base,
    E2E_PRODUCT: 'dreamer',
    E2E_PLATFORM: 'web',
    E2E_BUGBASH: '1',
    EXPO_PUBLIC_MOCK_MODE: 'true',
    EXPO_PUBLIC_MOCK_AUDIO: 'true',
    EXPO_PUBLIC_MOCK_PERSISTENCE: 'true',
  };
  assertLocalMock(env);
  return env;
}

function chatgptLoginPresent(env = process.env) {
  if (env.E2E_OAUTH_CREDENTIALS) {
    try { return Boolean(JSON.parse(env.E2E_OAUTH_CREDENTIALS).openai); } catch { return false; }
  }
  const file = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'e2e', 'oauth.json');
  if (!existsSync(file)) return false;
  try { return Boolean(JSON.parse(readFileSync(file, 'utf8')).openai); } catch { return false; }
}

function explore(charter, env) {
  const cli = join(here, 'node_modules/e2e/dist/cli/bin.js');
  if (!existsSync(cli)) {
    console.error('e2e 0.21.3 n\'est pas installe. npm run test:testerarmy:setup && npm run test:testerarmy:browsers');
    return 2;
  }
  console.log(`\n# ${charter.slug}`);
  const result = spawnSync(process.execPath, [
    cli, 'explore', charter.goal,
    '--config', 'e2e.bugbash.config.ts',
    '--target', 'dreamer-web',
    '--agent', charter.agent,
    '--output', `.e2e/bugbash/${charter.slug}`,
    '--max-steps', '6',
    '--reporter', 'list,markdown',
  ], { cwd: here, env, stdio: 'inherit' });
  return result.status ?? 1;
}

export function runBugbash({ exploreCharters = true, env = mockEnv(), login = chatgptLoginPresent() } = {}) {
  console.log('Bug bash pre-release, Dreamer web, mock only, loopback. Pas de production, pas d\'emulateur.');
  console.log('Chaque bug confirme devient un test qui echoue: tools/e2e/tests/bugbash/<slug>.e2e.ts, tag bugbash.');
  console.log('verify:release rejoue ces tests (test:bugbash:repros). La porte PR les exclut.');
  for (const charter of CHARTERS) console.log(`- ${charter.slug} (${charter.agent})`);
  if (!exploreCharters) return 0;
  if (!login) {
    console.error('Connexion ChatGPT absente. npm run test:testerarmy:login puis relancer npm run test:bugbash:prerelease.');
    return 2;
  }
  for (const charter of CHARTERS) {
    const status = explore(charter, env);
    if (status === 2 || status === 3) return status;
  }
  console.log('Charters termines. Un finding n\'est un bug que lorsque son test bugbash echoue avec ASSERTION_FAILED.');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = process.argv.includes('--plan');
  try {
    process.exitCode = runBugbash({ exploreCharters: !plan });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
