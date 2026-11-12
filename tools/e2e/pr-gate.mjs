/**
 * PR-gate launcher for Dreamer/Lucid/Meditation web journeys.
 * A diff with no web app zone exits 0 without a browser, unless an OpenAI
 * key lets the decision model judge an unzoned Dreamer app diff.
 * A native-only diff does too: this gate has no emulator. When a zone is touched, a missing
 * pinned Node, e2e install, or Chromium exits 1. verify:pr probes the same
 * condition first and records the check unavailable, so the proof is
 * incomplete instead of passed. On a published master the diff is empty, so a
 * release run launches nothing either.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_PRODUCTS, decisionEnabled, isDreamerAppPath, isNativeJourney, isSmokeStackPath, isUnzonedJourney, journeysOfChange, zonesForFiles } from './zones.mjs';
import { dreamerCampaignContexts } from './campaign-contexts.mjs';
import { SDK_PINS } from './qualification.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PINNED_NODE = 'v24.22.1';

/** The web product whose campaign holds a changed journey file, if any. A release-only file (UNZONED) has none. */
export function changedJourneyProduct(file) {
  if (!file.startsWith('tools/e2e/tests/') || !file.endsWith('.web.e2e.ts') || isNativeJourney(file) || isUnzonedJourney(file)) return null;
  const name = file.slice('tools/e2e/tests/'.length);
  if (name.includes('/')) return null;
  if (name.startsWith('dreamer')) return 'dreamer';
  if (/^lucid\.([a-z0-9]+\.)?web\.e2e\.ts$/.test(name)) return 'lucid';
  if (name === 'meditation.web.e2e.ts') return 'meditation';
  return null;
}

/**
 * `model`: whether the decision model judges the parcours the zones leave out
 * (an OpenAI key is set). It then sees every Dreamer app diff, named
 * zone or not, for Dreamer and Lucid, which run on the same app code.
 */
export function decideParcours(files, { model = decisionEnabled(process.env) } = {}) {
  const zones = zonesForFiles(files).filter(zone => zone.platform === 'web');
  // A changed journey runs even when no source zone matched: the decision
  // filter keeps it too, so a fixed or retagged journey is proved in the PR.
  // A shared step stands for the journeys that import it.
  const journeyProducts = files.flatMap(journeysOfChange).map(changedJourneyProduct).filter(Boolean);
  const modelProducts = model && files.some(isDreamerAppPath) ? DECISION_PRODUCTS : [];
  if (zones.length === 0 && journeyProducts.length === 0 && modelProducts.length === 0) {
    if (files.some(isNativeJourney) && !files.some(isDreamerAppPath)) {
      return {
        launch: false,
        reason: 'PARCOURS SAUTE: seuls des parcours natifs ont change. La porte PR n\'a pas d\'emulateur ni de simulateur, donc ces parcours ne partent pas.',
      };
    }
    return {
      launch: false,
      reason: 'PARCOURS SAUTE: aucune zone declaree ni parcours web modifie dans le diff. Une PR documentation, ou un fichier applicatif sans zone quand OPENAI_API_KEY est absente, ne lance pas de navigateur.',
    };
  }
  return { launch: true, products: [...new Set([...zones.map(zone => zone.product), ...journeyProducts, ...modelProducts])] };
}

export function decideSmoke(files) {
  // The parcours selection leaves smoke-tagged tests to this gate, so a changed
  // Dreamer journey also starts it: its smoke tests then run here. So does a
  // change to the stack every journey runs on (dependencies, build config, runner).
  if (!files.some(isDreamerAppPath) && !files.some(isSmokeStackPath) && !files.some(file => changedJourneyProduct(file) === 'dreamer')) {
    return {
      launch: false,
      reason: 'FUMEE SAUTEE: aucun chemin Dreamer (app, components, services, context, hooks, lib, constants), ni dependance, config de build ou runner e2e, ni parcours Dreamer modifie. Une PR documentation, Lucid seule ou Meditation seule ne lance pas cette fumee.',
    };
  }
  return { launch: true, products: ['dreamer'] };
}

export function changedFiles(root, git = spawnSync) {
  const base = git('git', ['merge-base', 'origin/master', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (base.status !== 0) {
    return { error: 'merge-base origin/master introuvable. Lancer git fetch origin master avant verify:pr.' };
  }
  const diff = git('git', ['diff', '--name-only', '-z', '--no-renames', base.stdout.trim(), 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (diff.status !== 0) return { error: (diff.stderr || 'git diff a echoue').trim() };
  return { files: diff.stdout.split('\0').filter(Boolean) };
}

function repoRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Pas un depot git.');
  return result.stdout.trim();
}

function loadBrowserRuntime(root) {
  const tools = join(root, 'tools/e2e');
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const require = createRequire(join(tools, 'package.json'));
  const engineRequire = createRequire(require.resolve('@e2e-dev/web'));
  const core = engineRequire.resolve('playwright-core/package.json');
  return {
    e2eVersion: read(join(tools, 'node_modules/e2e/package.json')).version,
    webVersion: read(join(tools, 'node_modules/@e2e-dev/web/package.json')).version,
    coreVersion: read(core).version,
    matcherVersion: read(require.resolve('playwright/package.json')).version,
    expectedBrowserVersion: read(join(dirname(core), 'browsers.json')).browsers
      .find(browser => browser.name === 'chromium-headless-shell')?.browserVersion,
    chromium: engineRequire('playwright-core').chromium,
  };
}

// Playwright's public executablePath names full Chrome, even when its default
// headless launch uses the independently installed headless shell. Probe the
// actual launch and version, so --only-shell stays supported without accepting
// another browser or weakening a missing-runner failure.
export async function probeWebBrowser(root, load = loadBrowserRuntime) {
  let browser;
  let result = { ok: false, code: 'BROWSER_UNAVAILABLE' };
  try {
    const runtime = load(root);
    if (runtime.e2eVersion !== SDK_PINS.e2e || runtime.webVersion !== SDK_PINS['@e2e-dev/web']
      || !runtime.coreVersion || runtime.coreVersion !== runtime.matcherVersion) {
      return { ok: false, code: 'ENGINE_VERSION' };
    }
    if (!runtime.expectedBrowserVersion) return { ok: false, code: 'BROWSER_VERSION' };
    browser = await runtime.chromium.launch({ headless: true, timeout: 10_000 });
    const version = browser.version();
    result = version === runtime.expectedBrowserVersion
      ? { ok: true, version, webVersion: runtime.webVersion, playwrightVersion: runtime.coreVersion }
      : { ok: false, code: 'BROWSER_VERSION' };
  } catch {
    // Do not emit a browser's environment or diagnostic payload in a readiness probe.
  } finally {
    if (browser) {
      try { await browser.close(); }
      catch { result = { ok: false, code: 'BROWSER_CLEANUP' }; }
    }
  }
  return result;
}

export function runnerReady(root) {
  if (process.version !== PINNED_NODE) {
    return { ok: false, reason: `PARCOURS NON JOUE: Node ${PINNED_NODE} est requis (mise exec), celui-ci est ${process.version}.` };
  }
  const cli = join(root, 'tools/e2e/node_modules/e2e/package.json');
  if (!existsSync(cli)) {
    return { ok: false, reason: 'PARCOURS NON JOUE: tools/e2e/node_modules est absent. npm run test:testerarmy:setup && npm run test:testerarmy:browsers.' };
  }
  try {
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import { probeWebBrowser } from ${JSON.stringify(import.meta.url)};
       const result = await probeWebBrowser(process.argv[1]);
       console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1;`, root],
    { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 });
    if (probe.status !== 0 || JSON.parse(probe.stdout).ok !== true) {
      return { ok: false, reason: 'PARCOURS NON JOUE: le Chromium headless du moteur epingle ne demarre pas ou sa version differe. npm run test:testerarmy:browsers.' };
    }
  } catch {
    return { ok: false, reason: 'PARCOURS NON JOUE: le moteur web n\'est pas installe. npm run test:testerarmy:setup && npm run test:testerarmy:browsers.' };
  }
  return { ok: true };
}

function launch(root, product, extra, environment) {
  const result = spawnSync(process.execPath, ['tools/e2e/run.mjs', product, 'web', 'run', ...extra], {
    cwd: root, stdio: 'inherit', env: { ...process.env, ...environment },
  });
  return result.status ?? 1;
}

/**
 * A systemic break (Metro or app crash) fails every journey at its assertion
 * timeout; each gate run stops after this many failures and skips the rest.
 */
export const GATE_MAX_FAILURES = '3';

export function gateContexts(mode, product) {
  const contexts = mode === 'parcours' && product === 'dreamer' ? dreamerCampaignContexts
    : [{ locale: product === 'lucid' ? 'fr-FR' : 'en-US', featureSheets: false, args: [] }];
  return contexts.map(({ locale, featureSheets, args }) => ({
    args,
    environment: { E2E_PERSONAS: '0', E2E_BUGBASH: '0', E2E_WEB_LOCALE: locale,
      EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: String(featureSheets) },
  }));
}

export function runGate(mode, root, files, ready = runnerReady(root), options = {}, execute = launch) {
  const decision = mode === 'smoke' ? decideSmoke(files) : decideParcours(files, options);
  if (!decision.launch) {
    console.log(decision.reason);
    return 0;
  }
  if (!ready.ok) {
    console.error(ready.reason);
    return 1;
  }
  const shared = [...(mode === 'smoke'
    ? ['--tag', 'smoke', '--exclude-tag', 'bugbash']
    : ['--changed-since', 'origin/master', '--exclude-tag', 'smoke', '--exclude-tag', 'bugbash', '--pass-with-no-tests']),
  '--max-failures', GATE_MAX_FAILURES];
  for (const product of decision.products) {
    // The source filter remains active in each context. A French-only parcours
    // must execute in French, not count as covered by an English skipped result.
    for (const context of gateContexts(mode, product)) {
      const status = execute(root, product, [...shared, ...context.args], context.environment);
      if (status !== 0) return status;
    }
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2];
  if (!['parcours', 'smoke', 'probe'].includes(mode)) {
    console.error('Usage: pr-gate.mjs parcours|smoke|probe parcours|smoke');
    process.exitCode = 2;
  } else {
    const which = mode === 'probe' ? process.argv[3] : mode;
    if (which !== 'parcours' && which !== 'smoke') {
      console.error('Usage: pr-gate.mjs probe parcours|smoke');
      process.exitCode = 2;
    } else {
      const root = repoRoot();
      const diff = changedFiles(root);
      if (diff.error) {
        console.error(diff.error);
        process.exitCode = 1;
      } else if (mode === 'probe') {
        const decision = which === 'smoke' ? decideSmoke(diff.files) : decideParcours(diff.files);
        if (!decision.launch) process.exitCode = 0;
        else {
          const ready = runnerReady(root);
          if (!ready.ok) {
            console.error(ready.reason);
            process.exitCode = 1;
          }
        }
      } else {
        process.exitCode = runGate(which, root, diff.files);
      }
    }
  }
}
