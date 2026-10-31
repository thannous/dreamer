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
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_KEYS, FORBIDDEN_PROJECT_REFS } from '../../scripts/test-supabase-guard.mjs';
import { sourceSnapshot, compareSnapshots, SDK_PINS } from './qualification.mjs';
import { PERSONA_ACT_MODEL } from './persona-models.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

export const CHARTERS = [
  { slug: 'capture', agent: 'default', session: 'guest', goal: 'Starting after onboarding on the dream capture screen of this local mock app, write a short dream and stay there. Report anything that blocks writing. Do not buy, subscribe, or leave the local origin.' },
  { slug: 'sauvegarde', agent: 'default', session: 'guest', goal: 'Save one dream in this local mock app and find the same text again after a reload. Report a save that loses the story. Do not buy or subscribe.' },
  { slug: 'journal', agent: 'skeptic', session: 'seeded', goal: 'As a guest with a seeded synthetic journal in this local mock app, apply a filter and check that the dreams on screen match it. Report a filter that hides the wrong dreams or loses the story. Do not sign in, buy or subscribe.' },
  { slug: 'paiement', agent: 'skeptic', session: 'guest', goal: 'Open the Plus offer in this local mock app and inspect the monthly price. Do not complete a purchase. Report a price or a button that would leave the mock. Never call a real store.' },
  { slug: 'connexion', agent: 'default', session: 'guest', goal: 'Open sign-in in this local mock app, choose a mock profile, and reach the capture screen signed in. Report a path that asks for a real account or leaves the local origin.' },
  { slug: 'saisies-limites', agent: 'fuzzer', session: 'guest', goal: 'Test the dream editor with this matrix: empty input, spaces only, 300 characters, and Unicode accents plus emoji. An empty story must not save, and a nonempty story must remain editable and survive one save and reload without corruption. Report the input and observed result for each case. Stay in the local mock.' },
  { slug: 'reprise', agent: 'default', session: 'draft', goal: 'Recover your interrupted, unsaved dream beginning "Bugbash recovery". Keep its original text and save it once, then reload and find that same entry. Report lost text, an inaccessible recovery action or duplicate entries. Stay in the local mock.' },
  { slug: 'reflexion', agent: 'skeptic', session: 'guest', goal: 'As a guest, save a short dream about a library and use its offered reading and conversation. Send one question, leave the conversation, then reopen it. Check that the same dream, question and simulated reply remain exactly once. Stay in the local mock without signing in.' },
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
    E2E_PERSONAS: '0',
    E2E_WORKERS: '1',
    E2E_WEB_LOCALE: 'fr-FR',
    EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'false',
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

function explore(charter, env, output) {
  const cli = join(here, 'node_modules/e2e/dist/cli/bin.js');
  if (!existsSync(cli)) {
    console.error('e2e 0.22.0 n\'est pas installe. npm run test:testerarmy:setup && npm run test:testerarmy:browsers');
    return 2;
  }
  console.log(`\n# ${charter.slug}`);
  const result = spawnSync(process.execPath, [
    cli, 'explore', charter.goal,
    '--config', 'e2e.bugbash.config.ts',
    '--target', 'dreamer-web',
    '--agent', charter.agent,
    '--session', `bugbash-${charter.session}`,
    '--output', output,
    '--max-steps', '6',
    '--reporter', 'list,markdown',
  ], { cwd: here, env: { ...env, E2E_OUTPUT: output }, stdio: 'inherit' });
  return result.status ?? 2;
}

// SDK findings are observations until a human/development agent triages them.
// A missing report or an exhausted/blocked step is never a clean exploration.
export function charterResult(charter, exitCode, report, reportPath, expectedOrigin = 'http://127.0.0.1:8096') {
  const run = report?.run;
  const exploration = run?.explore;
  const valid = report?.schemaVersion === 'report-1' && Array.isArray(exploration?.findings) && Array.isArray(exploration?.steps);
  const target = Array.isArray(run?.targets) && run.targets.length === 1 ? run.targets[0] : null;
  const results = Array.isArray(run?.results) ? run.results : [];
  const models = results.flatMap(result => (Array.isArray(result?.attempts) ? result.attempts : []).flatMap(attempt =>
    (Array.isArray(attempt?.steps) ? attempt.steps : []).filter(step => Number.isSafeInteger(step.model?.calls) && step.model.calls > 0).map(step => ({
      provider: step.model.provider, model: step.model.model,
    }))));
  const identity = run?.runner?.name === 'e2e' && run.runner.version === SDK_PINS.e2e
    && target?.id === 'dreamer-web' && target.platform === 'web' && target.environment === 'test'
    && target.baseOrigin === expectedOrigin && target.engine?.name === 'web' && target.engine.version === SDK_PINS['@e2e-dev/web']
    && models.length > 0 && models.every(model => model.provider === 'chatgpt.responses' && model.model === PERSONA_ACT_MODEL);
  const incomplete = !valid || !identity || ![0, 1].includes(exitCode) || exploration.ended !== 'finished'
    || exploration.steps.length === 0 || exploration.steps.some(step => step.status !== 'passed');
  const findings = valid ? exploration.findings.map(finding => ({
    id: `${charter.slug}:${finding.id}`, observation: finding, status: 'unreviewed',
    reason: null, reproTest: null, reproReport: null, reproResult: null,
  })) : [];
  return { slug: charter.slug, agent: charter.agent, session: `bugbash-${charter.session}`,
    goal: charter.goal, exitCode, report: reportPath,
    runner: run?.runner ?? null, targets: run?.targets ?? [], models: [...new Map(models.map(model => [JSON.stringify(model), model])).values()], usage: run?.usage ?? null,
    state: incomplete ? 'incomplete' : findings.length || exitCode === 1 ? 'needs-triage' : 'no-findings',
    ended: exploration?.ended ?? null, findings };
}

export function campaignExit(charters, stable = true) {
  if (!stable || charters.some(charter => charter.state === 'incomplete')) return 2;
  return charters.some(charter => charter.state === 'needs-triage') ? 1 : 0;
}

export function runBugbash({ exploreCharters = true, env = mockEnv(), login = chatgptLoginPresent(), only } = {}) {
  assertLocalMock(env);
  const selected = only ? CHARTERS.filter(charter => charter.slug === only) : CHARTERS;
  if (!selected.length) throw new Error(`Unknown bug bash charter: ${only}`);
  console.log('Bug bash pre-release, Dreamer web, mock only, loopback. Pas de production, pas d\'emulateur.');
  console.log('Chaque bug confirme devient un test qui echoue: tools/e2e/tests/bugbash/<slug>.e2e.ts, tag bugbash.');
  console.log('verify:release rejoue ces tests (test:bugbash:repros). La porte PR les exclut.');
  for (const charter of selected) console.log(`- ${charter.slug} (${charter.agent}, bugbash-${charter.session})`);
  if (!exploreCharters) return 0;
  if (!login) {
    console.error('Connexion ChatGPT absente. npm run test:testerarmy:login puis relancer npm run test:bugbash:prerelease.');
    return 2;
  }
  const campaign = `.e2e/bugbash/${Date.now()}-${randomUUID()}`;
  const output = join(here, campaign);
  mkdirSync(output, { recursive: true });
  const before = sourceSnapshot(root, 'dreamer');
  const installedSdk = Object.fromEntries(Object.keys(SDK_PINS).map(name => {
    try { return [name, JSON.parse(readFileSync(join(here, 'node_modules', name, 'package.json'), 'utf8')).version]; }
    catch { return [name, null]; }
  }));
  const port = Number(env.E2E_WEB_PORT ?? 8096);
  const expectedOrigin = Number.isInteger(port) && port >= 1 && port <= 65535 ? `http://127.0.0.1:${port}` : null;
  const receipt = { schemaVersion: 1, startedAt: new Date().toISOString(), source: before,
    scope: 'Dreamer web, local mock and synthetic sessions', model: PERSONA_ACT_MODEL, expectedSdk: SDK_PINS, installedSdk, expectedOrigin,
    rerunCommand: `mise exec -- npm run test:bugbash:prerelease${only ? ` -- --charter ${only}` : ''}`,
    selected: selected.map(charter => charter.slug), charters: [] };
  const save = () => writeFileSync(join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  save();
  if (!expectedOrigin || Object.entries(SDK_PINS).some(([name, version]) => installedSdk[name] !== version)) {
    receipt.finishedAt = new Date().toISOString();
    receipt.exitCode = 2;
    receipt.error = !expectedOrigin ? 'INVALID_WEB_PORT' : 'INSTALLED_SDK_PINS';
    save();
    console.error(`Bug bash incomplete: ${receipt.error}. Receipt: ${join(output, 'receipt.json')}`);
    return 2;
  }
  for (const charter of selected) {
    const child = `${campaign}/${charter.slug}`;
    const status = explore(charter, env, child);
    const reportPath = join(here, child, 'report.json');
    let report;
    try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch { /* Kept as incomplete. */ }
    receipt.charters.push(charterResult(charter, status, report, reportPath, expectedOrigin));
    save();
    if (![0, 1].includes(status)) break;
  }
  receipt.sourceComparison = compareSnapshots(before, sourceSnapshot(root, 'dreamer'));
  receipt.finishedAt = new Date().toISOString();
  receipt.exitCode = campaignExit(receipt.charters, receipt.sourceComparison.sourceStable && receipt.charters.length === selected.length);
  save();
  console.log(`Recu de campagne: ${join(output, 'receipt.json')}`);
  console.log('Trier chaque observation avec sa raison et ses chemins reproTest/reproReport. Un bug confirme exige une reproduction ASSERTION_FAILED.');
  console.log('Code 0: aucune observation, 1: tri requis, 2: exploration incomplete. Aucun de ces codes ne remplace la qualification release.');
  return receipt.exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = process.argv.includes('--plan');
  try {
    const index = process.argv.indexOf('--charter');
    if (index !== -1 && (!process.argv[index + 1] || process.argv[index + 1].startsWith('--'))) throw new Error('--charter needs a slug.');
    process.exitCode = runBugbash({ exploreCharters: !plan, only: index === -1 ? undefined : process.argv[index + 1] });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
