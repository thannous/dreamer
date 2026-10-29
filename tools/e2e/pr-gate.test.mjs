import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideParcours, decideSmoke } from './pr-gate.mjs';

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
