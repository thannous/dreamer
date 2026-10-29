/**
 * PR-gate launcher for Dreamer/Lucid/Meditation web journeys.
 * Docs-only and non-app diffs exit 0 without a browser. A native-only diff
 * exits 0 with a skip line: this gate has no emulator. A missing e2e install,
 * Chromium, or the pinned Node does the same, so a runner that cannot start
 * the web app does not fail the proof. The log line says the journeys did
 * not run.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDreamerAppPath, isNativeJourney, zonesForFiles } from './zones.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PINNED_NODE = 'v24.22.1';

export function decideParcours(files) {
  const zones = zonesForFiles(files).filter(zone => zone.platform === 'web');
  if (zones.length === 0) {
    if (files.some(isNativeJourney) && !files.some(isDreamerAppPath)) {
      return {
        launch: false,
        reason: 'PARCOURS SAUTE: seuls des parcours natifs ont change. La porte PR n\'a pas d\'emulateur ni de simulateur, donc ces parcours ne partent pas.',
      };
    }
    return {
      launch: false,
      reason: 'PARCOURS SAUTE: aucun parcours nomme (capture, sauvegarde, journal, paiement, connexion, lucid, meditation) dans le diff. Une PR documentation, ou un fichier applicatif sans zone, ne lance pas de navigateur.',
    };
  }
  return { launch: true, products: [...new Set(zones.map(zone => zone.product))] };
}

export function decideSmoke(files) {
  if (!files.some(isDreamerAppPath)) {
    return {
      launch: false,
      reason: 'FUMEE SAUTEE: aucun chemin Dreamer (app, components, services, context, hooks, lib, constants). Une PR documentation, Lucid seule ou Meditation seule ne lance pas cette fumee.',
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
    return { ok: false, reason: `PARCOURS SAUTE: Node ${PINNED_NODE} est requis (mise exec), celui-ci est ${process.version}. Les parcours ne sont pas lances.` };
  }
  const cli = join(root, 'tools/e2e/node_modules/e2e/package.json');
  if (!existsSync(cli)) {
    return { ok: false, reason: 'PARCOURS SAUTE: tools/e2e/node_modules est absent. Installer avec npm run test:testerarmy:setup && npm run test:testerarmy:browsers. Cette passe ne prouve pas les parcours.' };
  }
  try {
    const require = createRequire(join(root, 'tools/e2e/package.json'));
    const web = require.resolve('@e2e-dev/web');
    const engineRequire = createRequire(web);
    const { chromium } = engineRequire('playwright-core');
    if (!existsSync(chromium.executablePath())) {
      return { ok: false, reason: 'PARCOURS SAUTE: Chromium du moteur web est absent. npm run test:testerarmy:browsers. Cette passe ne prouve pas les parcours.' };
    }
  } catch {
    return { ok: false, reason: 'PARCOURS SAUTE: le moteur web n\'est pas installé. npm run test:testerarmy:setup && npm run test:testerarmy:browsers.' };
  }
  return { ok: true };
}

function launch(root, product, extra) {
  const result = spawnSync(process.execPath, ['tools/e2e/run.mjs', product, 'web', 'run', ...extra], {
    cwd: root, stdio: 'inherit', env: process.env,
  });
  return result.status ?? 1;
}

export function runGate(mode, root, files) {
  const decision = mode === 'smoke' ? decideSmoke(files) : decideParcours(files);
  if (!decision.launch) {
    console.log(decision.reason);
    return 0;
  }
  const ready = runnerReady(root);
  if (!ready.ok) {
    console.log(ready.reason);
    return 0;
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
  if (mode !== 'parcours' && mode !== 'smoke') {
    console.error('Usage: pr-gate.mjs parcours|smoke');
    process.exitCode = 2;
  } else {
    const root = repoRoot();
    const diff = changedFiles(root);
    if (diff.error) {
      console.error(diff.error);
      process.exitCode = 1;
    } else {
      process.exitCode = runGate(mode, root, diff.files);
    }
  }
}
