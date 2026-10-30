/**
 * PR-gate launcher for Dreamer/Lucid/Meditation web journeys.
 * A diff with no web app zone exits 0 without a browser, unless a Vercel AI
 * Gateway key lets the decision model judge an unzoned Dreamer app diff. A native-only diff
 * does too: this gate has no emulator. When a zone is touched, a missing
 * pinned Node, e2e install, or Chromium exits 1. verify:pr probes the same
 * condition first and records the check unavailable, so the proof is
 * incomplete instead of passed.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_PRODUCTS, decisionEnabled, isDreamerAppPath, isNativeJourney, zonesForFiles } from './zones.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PINNED_NODE = 'v24.22.1';

/** The web product whose campaign holds a changed journey file, if any. */
export function changedJourneyProduct(file) {
  if (!file.startsWith('tools/e2e/tests/') || !file.endsWith('.web.e2e.ts') || isNativeJourney(file)) return null;
  const name = file.slice('tools/e2e/tests/'.length);
  if (name.includes('/')) return null;
  if (name.startsWith('dreamer')) return 'dreamer';
  if (name === 'lucid.web.e2e.ts') return 'lucid';
  if (name === 'meditation.web.e2e.ts') return 'meditation';
  return null;
}

/**
 * `model`: whether the decision model judges the parcours the zones leave out
 * (a Vercel AI Gateway key is set). It then sees every Dreamer app diff, named
 * zone or not, for Dreamer and Lucid, which run on the same app code.
 */
export function decideParcours(files, { model = decisionEnabled(process.env) } = {}) {
  const zones = zonesForFiles(files).filter(zone => zone.platform === 'web');
  // A changed journey runs even when no source zone matched: the decision
  // filter keeps it too, so a fixed or retagged journey is proved in the PR.
  const journeyProducts = files.map(changedJourneyProduct).filter(Boolean);
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
      reason: 'PARCOURS SAUTE: aucun parcours nomme (capture, sauvegarde, journal, paiement, connexion, lucid, meditation) dans le diff. Une PR documentation, ou un fichier applicatif sans zone quand AI_GATEWAY_API_KEY est absente, ne lance pas de navigateur.',
    };
  }
  return { launch: true, products: [...new Set([...zones.map(zone => zone.product), ...journeyProducts, ...modelProducts])] };
}

export function decideSmoke(files) {
  // The parcours selection leaves smoke-tagged tests to this gate, so a changed
  // Dreamer journey also starts it: its smoke tests then run here.
  if (!files.some(isDreamerAppPath) && !files.some(file => changedJourneyProduct(file) === 'dreamer')) {
    return {
      launch: false,
      reason: 'FUMEE SAUTEE: aucun chemin Dreamer (app, components, services, context, hooks, lib, constants) ni parcours Dreamer modifie. Une PR documentation, Lucid seule ou Meditation seule ne lance pas cette fumee.',
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

export function runnerReady(root) {
  if (process.version !== PINNED_NODE) {
    return { ok: false, reason: `PARCOURS NON JOUE: Node ${PINNED_NODE} est requis (mise exec), celui-ci est ${process.version}.` };
  }
  const cli = join(root, 'tools/e2e/node_modules/e2e/package.json');
  if (!existsSync(cli)) {
    return { ok: false, reason: 'PARCOURS NON JOUE: tools/e2e/node_modules est absent. npm run test:testerarmy:setup && npm run test:testerarmy:browsers.' };
  }
  try {
    const require = createRequire(join(root, 'tools/e2e/package.json'));
    const web = require.resolve('@e2e-dev/web');
    const engineRequire = createRequire(web);
    const { chromium } = engineRequire('playwright-core');
    if (!existsSync(chromium.executablePath())) {
      return { ok: false, reason: 'PARCOURS NON JOUE: Chromium du moteur web est absent. npm run test:testerarmy:browsers.' };
    }
  } catch {
    return { ok: false, reason: 'PARCOURS NON JOUE: le moteur web n\'est pas installe. npm run test:testerarmy:setup && npm run test:testerarmy:browsers.' };
  }
  return { ok: true };
}

function launch(root, product, extra) {
  const result = spawnSync(process.execPath, ['tools/e2e/run.mjs', product, 'web', 'run', ...extra], {
    cwd: root, stdio: 'inherit', env: process.env,
  });
  return result.status ?? 1;
}

export function runGate(mode, root, files, ready = runnerReady(root), options = {}) {
  const decision = mode === 'smoke' ? decideSmoke(files) : decideParcours(files, options);
  if (!decision.launch) {
    console.log(decision.reason);
    return 0;
  }
  if (!ready.ok) {
    console.error(ready.reason);
    return 1;
  }
  const shared = mode === 'smoke'
    ? ['--tag', 'smoke', '--exclude-tag', 'bugbash']
    : ['--changed-since', 'origin/master', '--exclude-tag', 'smoke', '--exclude-tag', 'bugbash', '--pass-with-no-tests'];
  for (const product of decision.products) {
    const status = launch(root, product, shared);
    if (status !== 0) return status;
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
