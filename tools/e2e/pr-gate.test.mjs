import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GATE_MAX_FAILURES, decideParcours, decideSmoke, runGate, probeWebBrowser } from './pr-gate.mjs';
import { SDK_PINS } from './qualification.mjs';
import { SMOKE_STACK, UNZONED, parcoursExclude, selectionOwesNothing } from './zones.mjs';

test('docs-only and non-app diffs skip both gates', () => {
  const files = ['doc_web_interne/docs/README.md', 'AGENTS.md', 'specs/noctalia-lucid-trainer.md'];
  assert.equal(decideParcours(files).launch, false);
  assert.match(decideParcours(files).reason, /PARCOURS SAUTE/);
  assert.equal(decideSmoke(files).launch, false);
  assert.match(decideSmoke(files).reason, /FUMEE SAUTEE/);
});

test('a Dreamer recording change runs parcours and smoke on web', () => {
  const files = ['app/recording.tsx', 'README.md'];
  assert.deepEqual(decideParcours(files, { model: false }).products, ['dreamer']);
  assert.deepEqual(decideSmoke(files).products, ['dreamer']);
});

test('an unmapped component runs smoke only', () => {
  const files = ['components/ui/Toast.tsx'];
  assert.equal(decideParcours(files, { model: false }).launch, false);
  assert.equal(decideSmoke(files).launch, true);
});

test('with the decision model, any Dreamer app diff lets it judge the Dreamer and Lucid parcours', () => {
  assert.deepEqual(decideParcours(['components/ui/Toast.tsx'], { model: true }).products, ['dreamer', 'lucid']);
  assert.deepEqual(decideParcours(['app/journal/[id].tsx'], { model: true }).products, ['dreamer', 'lucid']);
  // Lucid-only and Meditation paths keep their own zone; docs and native journeys still launch nothing.
  assert.deepEqual(decideParcours(['routes/lucid/lucid/index.tsx'], { model: true }).products, ['lucid']);
  assert.deepEqual(decideParcours(['apps/meditation/app/index.tsx'], { model: true }).products, ['meditation']);
  assert.equal(decideParcours(['doc_web_interne/docs/README.md', 'AGENTS.md'], { model: true }).launch, false);
  assert.equal(decideParcours(['tools/e2e/tests/dreamer.mobile.e2e.ts'], { model: true }).launch, false);
  // The key turns it on.
  const saved = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = 'test-key';
    assert.equal(decideParcours(['components/ui/Toast.tsx']).launch, true);
    process.env.OPENAI_API_KEY = '  ';
    assert.equal(decideParcours(['components/ui/Toast.tsx']).launch, false);
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
});

test('a parcours proof made without the key is not reused once the key turns the model on', async () => {
  const { decisionEnabled } = await import('./zones.mjs');
  const saved = process.env.OPENAI_API_KEY;
  const envOf = async (key, tag) => {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    // A fresh module instance reads the environment again.
    const { default: config } = await import(`${new URL('../../verify-local.config.mjs', import.meta.url).href}?${tag}`);
    return config.checks.find(check => check.name === 'parcours-touches').env;
  };
  try {
    for (const [key, tag] of [[undefined, 'none'], ['  ', 'blank'], ['sk-test', 'set']]) {
      const env = await envOf(key, tag);
      assert.deepEqual(env, { E2E_DECISION_FILTER: decisionEnabled({ OPENAI_API_KEY: key }) ? 'on' : 'off' }, tag);
      assert.equal(JSON.stringify(env).includes('sk-test'), false);
    }
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
});

test('an empty English selection advances to the changed French journey', () => {
  const file = 'tools/e2e/tests/dreamer-symbol-dictionary.web.e2e.ts';
  const pair = { id: 'fr-dictionary', tags: ['locale-fr-FR'], file: 'tests/dreamer-symbol-dictionary.web.e2e.ts' };
  const visited = [];
  const execute = (_root, _product, _args, env) => {
    visited.push(env.E2E_WEB_LOCALE);
    const disposition = env.E2E_WEB_LOCALE === 'fr-FR' ? 'run' : 'skip';
    return disposition === 'run' || selectionOwesNothing([{ ...pair, disposition }], [file], env.E2E_WEB_LOCALE) ? 0 : 1;
  };
  assert.equal(runGate('parcours', '/tmp', [file], { ok: true }, { model: false }, execute), 0);
  assert.ok(visited.indexOf('en-US') < visited.indexOf('fr-FR'));
  assert.ok(visited.includes('fr-FR'));
  const stillSkipped = (_root, _product, _args, env) =>
    selectionOwesNothing([{ ...pair, disposition: 'skip' }], [file], env.E2E_WEB_LOCALE) ? 0 : 1;
  assert.equal(runGate('parcours', '/tmp', [file], { ok: true }, { model: false }, stillSkipped), 1);
});

test('a model-judged diff without the runner fails like a touched zone', () => {
  const missing = { ok: false, reason: 'PARCOURS NON JOUE: Chromium absent' };
  assert.equal(runGate('parcours', '/tmp', ['components/ui/Toast.tsx'], missing, { model: false }), 0);
  assert.equal(runGate('parcours', '/tmp', ['components/ui/Toast.tsx'], missing, { model: true }), 1);
});

test('a native-only diff skips instead of failing', () => {
  const files = ['tools/e2e/tests/dreamer.mobile.e2e.ts'];
  const decision = decideParcours(files);
  assert.equal(decision.launch, false);
  assert.match(decision.reason, /emulateur/);
  assert.equal(decideSmoke(files).launch, false);
});

test('a change to the stack every journey runs on starts the smoke set, docs and unrelated tooling do not', () => {
  for (const file of ['package-lock.json', 'patches/expo+58.0.23.patch', 'app.json', 'tools/e2e/package.json',
    'tools/e2e/e2e.config.ts', 'tools/e2e/web-journeys.ts', 'tools/e2e/traced-parity-test.ts']) {
    assert.deepEqual(decideSmoke([file]).products, ['dreamer'], file);
  }
  for (const file of ['README.md', 'tools/e2e/README.md', 'tools/dev-local/manifest.mts', 'scripts/verify-local-config.test.js']) {
    assert.equal(decideSmoke([file]).launch, false, file);
  }
});

test('Lucid and Meditation do not start the Dreamer smoke set', () => {
  assert.equal(decideSmoke(['routes/lucid/lucid/index.tsx']).launch, false);
  assert.deepEqual(decideParcours(['routes/lucid/lucid/index.tsx']).products, ['lucid']);
  assert.equal(decideSmoke(['apps/meditation/app/index.tsx']).launch, false);
  assert.deepEqual(decideParcours(['apps/meditation/app/index.tsx']).products, ['meditation']);
});

test('a missing runner fails only when a web zone would actually run', () => {
  const missing = { ok: false, reason: 'PARCOURS NON JOUE: Chromium absent' };
  assert.equal(runGate('parcours', '/tmp', ['AGENTS.md'], missing), 0);
  assert.equal(runGate('parcours', '/tmp', ['tools/e2e/tests/dreamer.mobile.e2e.ts'], missing), 0);
  assert.equal(runGate('smoke', '/tmp', ['doc_web_interne/docs/README.md'], missing), 0);
  assert.equal(runGate('parcours', '/tmp', ['app/recording.tsx'], missing), 1);
  assert.equal(runGate('smoke', '/tmp', ['components/ui/Toast.tsx'], missing), 1);
});

test('a change to a shared journey step runs the journeys that import it', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { PARCOURS_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  for (const step of ['tools/e2e/web-journeys.ts', 'tools/e2e/traced-parity-test.ts', 'tools/e2e/onboarding-fixtures.ts']) {
    assert.equal(matchesAny(step, PARCOURS_WHEN), true, step);
    assert.deepEqual(decideParcours([step], { model: false }).products, ['dreamer'], step);
  }
});

test('verify:pr reaches the smoke check for every path of the stack the smoke gate watches', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { SMOKE_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  for (const entry of SMOKE_STACK) {
    const file = entry.endsWith('/') ? `${entry}sample.ts` : entry;
    assert.equal(matchesAny(file, SMOKE_WHEN), true, file);
    assert.deepEqual(decideSmoke([file]).products, ['dreamer'], file);
  }
});

test('verify:pr scopes skip docs and keep the named app paths', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { SMOKE_WHEN, PARCOURS_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  assert.equal(matchesAny('doc_web_interne/docs/README.md', SMOKE_WHEN), false);
  assert.equal(matchesAny('doc_web_interne/docs/README.md', PARCOURS_WHEN), false);
  assert.equal(matchesAny('AGENTS.md', SMOKE_WHEN), false);
  assert.equal(matchesAny('app/recording.tsx', SMOKE_WHEN), true);
  assert.equal(matchesAny('services/captureSave.ts', SMOKE_WHEN), true);
  assert.equal(matchesAny('routes/lucid/lucid/index.tsx', SMOKE_WHEN), false);
  assert.equal(matchesAny('apps/meditation/app/index.tsx', SMOKE_WHEN), false);
  assert.equal(matchesAny('app/journal/[id].tsx', PARCOURS_WHEN), true);
  assert.equal(matchesAny('tools/e2e/zones.mjs', PARCOURS_WHEN), true);
  assert.equal(matchesAny('tools/e2e/pr-gate.mjs', PARCOURS_WHEN), true);
  // Unit tests next to app code skip both checks; the gate's own tests still reach parcours.
  for (const file of ['lib/__tests__/dreamUtils.test.ts', 'hooks/useSubscription.test.tsx',
    'components/journal/__tests__/__snapshots__/DreamCard.test.tsx.snap', 'apps/meditation/app/__tests__/index.test.tsx']) {
    assert.equal(matchesAny(file, SMOKE_WHEN), false, file);
    assert.equal(matchesAny(file, PARCOURS_WHEN), false, file);
  }
  assert.equal(matchesAny('tools/e2e/pr-gate.test.mjs', PARCOURS_WHEN), true);
  assert.equal(matchesAny('tools/e2e/zone-filter.test.mjs', PARCOURS_WHEN), true);
  assert.equal(matchesAny('tools/e2e/tests/dreamer-billing.web.e2e.ts', SMOKE_WHEN), true);
});

test('a changed web journey runs its campaign even without a source zone', () => {
  assert.deepEqual(decideParcours(['tools/e2e/tests/dreamer-billing.web.e2e.ts']).products, ['dreamer']);
  assert.deepEqual(decideParcours(['tools/e2e/tests/lucid.web.e2e.ts']).products, ['lucid']);
  assert.deepEqual(decideParcours(['tools/e2e/tests/meditation.web.e2e.ts']).products, ['meditation']);
  // Native, bug bash, backend and support files are not web journeys of these campaigns.
  for (const file of ['tools/e2e/tests/dreamer.mobile.e2e.ts', 'tools/e2e/tests/bugbash/example.e2e.ts',
    'tools/e2e/tests/backend-sync.web.e2e.ts', 'tools/e2e/zones.mjs']) {
    assert.equal(decideParcours([file]).launch, false, file);
  }
});

test('an edit to a release-only journey file starts neither gate; the release campaign runs it', () => {
  const files = Object.keys(UNZONED);
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.equal(decideParcours([file], { model: false }).launch, false, file);
    assert.equal(decideSmoke([file]).launch, false, file);
  }
  // With a zone touched in the same diff, the zone's journeys run, not the release-only file.
  const release = { id: 'broad', tags: [], file: files[0] };
  assert.equal(parcoursExclude([release], [files[0], 'app/journal/[id].tsx']).exclude.broad, 'le diff ne touche pas ce parcours');
});

test('unit tests and snapshots under the app folders start neither gate', () => {
  const files = ['lib/__tests__/dreamUtils.test.ts', 'hooks/useSubscription.test.tsx',
    'components/journal/__tests__/__snapshots__/DreamCard.test.tsx.snap'];
  assert.equal(decideParcours(files, { model: true }).launch, false);
  assert.equal(decideSmoke(files).launch, false);
  // The source next to them still starts both.
  assert.equal(decideSmoke(['hooks/useSubscription.ts']).launch, true);
  assert.deepEqual(decideParcours(['hooks/useSubscription.ts'], { model: false }).products, ['dreamer']);
});

test('verify:pr reaches the gate for every web journey the gate would run', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { PARCOURS_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  const { readdirSync } = await import('node:fs');
  // The engine skips parcours-touches when no path matches, before the gate runs:
  // each journey the gate launches must also be in the check's scope.
  const journeys = readdirSync(new URL('./tests/', import.meta.url))
    .map(name => `tools/e2e/tests/${name}`)
    .filter(file => decideParcours([file], { model: false }).launch);
  assert.ok(journeys.includes('tools/e2e/tests/lucid.web.e2e.ts'));
  assert.ok(journeys.includes('tools/e2e/tests/meditation.web.e2e.ts'));
  assert.ok(journeys.includes('tools/e2e/tests/dreamer-home-editorial.web.e2e.ts'));
  for (const file of journeys) assert.equal(matchesAny(file, PARCOURS_WHEN), true, file);
});

test('a changed smoke journey runs in the smoke check, which verify:pr reaches', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { SMOKE_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  const { parcoursExclude } = await import('./zones.mjs');
  const file = 'tools/e2e/tests/dreamer-capture-save.web.e2e.ts';
  // The parcours selection leaves its smoke test out by design...
  const smokeTest = { id: 'save', tags: ['capture-save', 'smoke', 'zone-sauvegarde'], file };
  assert.equal(parcoursExclude([smokeTest], [file]).exclude.save, 'la fumée PR joue ce parcours');
  // ...so the smoke check must be in scope and launch for that diff alone.
  assert.equal(matchesAny(file, SMOKE_WHEN), true);
  assert.deepEqual(decideSmoke([file]).products, ['dreamer']);
  // Lucid and Meditation journeys carry no smoke tag and do not start it.
  assert.equal(decideSmoke(['tools/e2e/tests/lucid.web.e2e.ts']).launch, false);
  assert.equal(matchesAny('tools/e2e/tests/meditation.web.e2e.ts', SMOKE_WHEN), false);
});

test('parcours launch each real language/feature context with the diff filter, no model and no personas', () => {
  const calls = [];
  const execute = (_root, product, args, environment) => { calls.push({ product, args, environment }); return 0; };
  assert.equal(runGate('parcours', '/unused', ['app/moon-letter.tsx'], { ok: true }, { model: false }, execute), 0);
  assert.deepEqual(calls.map(call => call.environment.E2E_WEB_LOCALE), ['en-US', 'fr-FR', 'de-DE', 'en-US']);
  for (const call of calls) {
    assert.equal(call.environment.E2E_PERSONAS, '0');
    assert.ok(call.args.includes('--changed-since'));
    assert.ok(call.args.includes('--pass-with-no-tests'));
    assert.equal(call.args[call.args.indexOf('--max-failures') + 1], GATE_MAX_FAILURES);
  }
  assert.equal(calls[3].environment.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED, 'false');
  assert.equal(runGate('parcours', '/unused', ['hooks/useQuota.ts'], { ok: true }, { model: false }, () => 3), 3);
});

test('smoke runs the tagged Dreamer journeys once, without bug bash, and stops a systemic break early', () => {
  const calls = [];
  const execute = (_root, product, args) => { calls.push({ product, args }); return 1; };
  assert.equal(runGate('smoke', '/unused', ['app/recording.tsx'], { ok: true }, {}, execute), 1);
  assert.deepEqual(calls, [{ product: 'dreamer', args: ['--tag', 'smoke', '--exclude-tag', 'bugbash', '--max-failures', GATE_MAX_FAILURES] }]);
  assert.ok(Number(GATE_MAX_FAILURES) >= 1);
});

test('model selection retains Dreamer language passes and the Lucid campaign', () => {
  const calls = [];
  const execute = (_root, product, args, environment) => { calls.push({ product, args, environment }); return 0; };
  assert.equal(runGate('parcours', '/unused', ['components/ui/Toast.tsx'], { ok: true }, { model: true }, execute), 0);
  assert.deepEqual(calls.map(call => call.product), ['dreamer', 'dreamer', 'dreamer', 'dreamer', 'lucid']);
  assert.deepEqual(calls.slice(0, 4).map(call => call.environment.E2E_WEB_LOCALE), ['en-US', 'fr-FR', 'de-DE', 'en-US']);
  for (const call of calls) {
    assert.equal(call.environment.E2E_PERSONAS, '0');
    assert.equal(call.environment.E2E_BUGBASH, '0');
    assert.ok(call.args.includes('--changed-since'));
  }
});

function browserRuntime(overrides = {}) {
  const closed = [];
  const browser = { version: () => '156.0.8078.4', close: async () => { closed.push(true); } };
  const runtime = {
    e2eVersion: SDK_PINS.e2e, webVersion: SDK_PINS['@e2e-dev/web'],
    coreVersion: '1.64.1', matcherVersion: '1.64.1', expectedBrowserVersion: '156.0.8078.4',
    chromium: { launch: async options => {
      assert.deepEqual(options, { headless: true, timeout: 10_000 });
      return browser;
    } }, ...overrides,
  };
  return { runtime, browser, closed };
}

test('browser readiness accepts the installed headless engine and closes it', async () => {
  const { runtime, closed } = browserRuntime();
  assert.deepEqual(await probeWebBrowser('/unused', () => runtime), {
    ok: true, version: '156.0.8078.4', webVersion: SDK_PINS['@e2e-dev/web'], playwrightVersion: '1.64.1',
  });
  assert.equal(closed.length, 1);
});

test('browser readiness rejects a missing shell instead of passing its metadata', async () => {
  const { runtime } = browserRuntime({ chromium: { launch: async () => { throw new Error('ENOENT'); } } });
  assert.deepEqual(await probeWebBrowser('/unused', () => runtime), { ok: false, code: 'BROWSER_UNAVAILABLE' });
});

test('browser readiness rejects a foreign SDK or mismatched engine and matcher before launching', async () => {
  for (const mismatch of [{ e2eVersion: '0.0.0' }, { webVersion: '0.0.0' }, { matcherVersion: '1.0.0' }]) {
    let launched = false;
    const { runtime } = browserRuntime({ ...mismatch, chromium: { launch: async () => { launched = true; } } });
    assert.deepEqual(await probeWebBrowser('/unused', () => runtime), { ok: false, code: 'ENGINE_VERSION' });
    assert.equal(launched, false);
  }
});

test('browser readiness rejects a browser version from another build and still closes it', async () => {
  const { runtime, closed } = browserRuntime({ expectedBrowserVersion: '155.0.0.0' });
  assert.deepEqual(await probeWebBrowser('/unused', () => runtime), { ok: false, code: 'BROWSER_VERSION' });
  assert.equal(closed.length, 1);
});

test('browser readiness refuses a failed browser cleanup', async () => {
  const { runtime, browser } = browserRuntime();
  browser.close = async () => { throw new Error('cleanup failed'); };
  assert.deepEqual(await probeWebBrowser('/unused', () => runtime), { ok: false, code: 'BROWSER_CLEANUP' });
});
