import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideParcours, decideSmoke, runGate } from './pr-gate.mjs';

test('docs-only and non-app diffs skip both gates', () => {
  const files = ['doc_web_interne/docs/README.md', 'AGENTS.md', 'specs/noctalia-lucid-trainer.md'];
  assert.equal(decideParcours(files).launch, false);
  assert.match(decideParcours(files).reason, /PARCOURS SAUTE/);
  assert.equal(decideSmoke(files).launch, false);
  assert.match(decideSmoke(files).reason, /FUMEE SAUTEE/);
});

test('a Dreamer recording change runs parcours and smoke on web', () => {
  const files = ['app/recording.tsx', 'README.md'];
  assert.deepEqual(decideParcours(files).products, ['dreamer']);
  assert.deepEqual(decideSmoke(files).products, ['dreamer']);
});

test('an unmapped component runs smoke only', () => {
  const files = ['components/ui/Toast.tsx'];
  assert.equal(decideParcours(files).launch, false);
  assert.equal(decideSmoke(files).launch, true);
});

test('a native-only diff skips instead of failing', () => {
  const files = ['tools/e2e/tests/dreamer.mobile.e2e.ts'];
  const decision = decideParcours(files);
  assert.equal(decision.launch, false);
  assert.match(decision.reason, /emulateur/);
  assert.equal(decideSmoke(files).launch, false);
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

test('verify:pr reaches the gate for every web journey the gate would run', async () => {
  const { matchesAny } = await import(new URL('../../scripts/verify-local.mjs', import.meta.url).href);
  const { PARCOURS_WHEN } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  const { readdirSync } = await import('node:fs');
  // The engine skips parcours-touches when no path matches, before the gate runs:
  // each journey the gate launches must also be in the check's scope.
  const journeys = readdirSync(new URL('./tests/', import.meta.url))
    .map(name => `tools/e2e/tests/${name}`)
    .filter(file => decideParcours([file]).launch);
  assert.ok(journeys.includes('tools/e2e/tests/lucid.web.e2e.ts'));
  assert.ok(journeys.includes('tools/e2e/tests/meditation.web.e2e.ts'));
  assert.ok(journeys.includes('tools/e2e/tests/dreamer-home-editorial.web.e2e.ts'));
  for (const file of journeys) assert.equal(matchesAny(file, PARCOURS_WHEN), true, file);
});
