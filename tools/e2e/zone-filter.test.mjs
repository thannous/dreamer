import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PERSONA_ACT_MODEL, PERSONA_ASSERT_MODEL } from './persona-models.mjs';
import { filterIsActive, isDreamerAppPath, isNativeJourney, parcoursExclude, selectionOwesNothing, zonesForFiles } from './zones.mjs';

const billing = { id: 'billing', tags: ['zone-paiement', 'historical-parity'], file: 'tools/e2e/tests/dreamer-billing.web.e2e.ts' };
const billingSmoke = { id: 'billing-smoke', tags: ['smoke', 'zone-paiement'], file: 'tools/e2e/tests/dreamer-billing.web.e2e.ts' };
const journal = { id: 'journal', tags: ['zone-journal'], file: 'tools/e2e/tests/dreamer-journal-filters.web.e2e.ts' };
const capture = { id: 'capture', tags: ['zone-capture'], file: 'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts' };
const other = { id: 'home', tags: ['historical-parity'], file: 'tools/e2e/tests/dreamer-home-editorial.web.e2e.ts' };
const bug = { id: 'bug', tags: ['bugbash'], file: 'tools/e2e/tests/bugbash/example.e2e.ts' };
const suite = [billing, billingSmoke, journal, capture, other, bug];

test('docs and non-app paths select no zone', () => {
  assert.deepEqual(zonesForFiles(['doc_web_interne/docs/README.md', 'AGENTS.md', 'scripts/verify-local.mjs']), []);
  const decision = parcoursExclude(suite, ['doc_web_interne/docs/README.md']);
  assert.equal(decision.note, 'aucun-parcours');
  assert.deepEqual(Object.keys(decision.exclude).sort(), suite.map(row => row.id).sort());
});

test('a journal path keeps the journal parcours and leaves the others out', () => {
  assert.deepEqual(zonesForFiles(['app/journal/[id].tsx']).map(zone => zone.id), ['journal']);
  const decision = parcoursExclude(suite, ['app/journal/[id].tsx']);
  assert.equal(decision.note, 'journal');
  assert.equal(decision.exclude.journal, undefined);
  assert.equal(decision.exclude.billing, 'le diff ne touche pas ce parcours');
  assert.equal(decision.exclude['billing-smoke'], 'la fumée PR joue ce parcours');
  assert.equal(decision.exclude.bug, 'bug bash hors porte PR');
  assert.equal(decision.exclude.home, 'le diff ne touche pas ce parcours');
});

test('capture save maps to sauvegarde and journal storage maps to both', () => {
  assert.deepEqual(zonesForFiles(['services/captureSave.ts']).map(zone => zone.id), ['sauvegarde']);
  assert.deepEqual(zonesForFiles(['services/journalRepository.ts']).map(zone => zone.id).sort(), ['journal', 'sauvegarde']);
});

test('an unmapped Dreamer component is app code and not a named zone', () => {
  assert.equal(isDreamerAppPath('components/ui/Toast.tsx'), true);
  assert.deepEqual(zonesForFiles(['components/ui/Toast.tsx']), []);
});

test('Lucid and Meditation stay out of the Dreamer smoke set', () => {
  assert.equal(isDreamerAppPath('routes/lucid/lucid/index.tsx'), false);
  assert.equal(isDreamerAppPath('services/lucidTrainerStorage.ts'), false);
  assert.equal(isDreamerAppPath('apps/meditation/app/index.tsx'), false);
  assert.equal(isDreamerAppPath('app/recording.tsx'), true);
  assert.deepEqual(zonesForFiles(['components/lucid/Atlas.tsx']).map(zone => zone.id), ['lucid']);
  assert.deepEqual(zonesForFiles(['apps/meditation/app/paywall.tsx']).map(zone => zone.id), ['meditation']);
});

test('a native journey is recognised and is not a web zone by itself', () => {
  assert.equal(isNativeJourney('tools/e2e/tests/dreamer.mobile.e2e.ts'), true);
  assert.equal(isNativeJourney('tools/e2e/tests/dreamer-journal-filters.web.e2e.ts'), false);
  assert.deepEqual(zonesForFiles(['tools/e2e/tests/dreamer.mobile.e2e.ts']), []);
});

test('a changed web test file is kept even when no source zone matched', () => {
  const decision = parcoursExclude(suite, ['tools/e2e/tests/dreamer-home-editorial.web.e2e.ts']);
  assert.equal(decision.exclude.home, undefined);
  assert.equal(decision.exclude.capture, 'le diff ne touche pas ce parcours');
});

test('only static skips the diff does not select leave the parcours selection empty', () => {
  // Engine pairs: files relative to tools/e2e, static skips listed whatever the diff.
  const localeSkip = { id: 'backgrounds', tags: ['historical-parity', 'locale-fr-FR'], file: 'tests/dreamer-backgrounds.web.e2e.ts', disposition: 'skip' };
  const journalSkip = { id: 'journal-fr', tags: ['zone-journal', 'locale-fr-FR'], file: 'tests/dreamer-journal-margin.web.e2e.ts', disposition: 'skip' };
  const skips = [localeSkip, journalSkip];
  // A smoke-only journey change: its test is the smoke check's, the skips are untouched.
  assert.equal(selectionOwesNothing(skips, ['tools/e2e/tests/dreamer-capture-save.web.e2e.ts', 'components/releases/WhatsNewModal.tsx']), true);
  // A changed locale-only journey is selected but cannot run here: the gate still fails.
  assert.equal(selectionOwesNothing(skips, ['tools/e2e/tests/dreamer-backgrounds.web.e2e.ts']), false);
  // So does a locale-only journey of a zone the diff touches.
  assert.equal(selectionOwesNothing(skips, ['app/journal/[id].tsx']), false);
  assert.equal(selectionOwesNothing([...skips, { ...billing, file: 'tests/dreamer-billing.web.e2e.ts', disposition: 'run' }], []), false);
});

test('the zone filter stays inactive unless --changed-since supplied changes', () => {
  assert.equal(filterIsActive(undefined), false);
  assert.equal(filterIsActive({}), false);
  assert.equal(filterIsActive({ changes: {} }), false);
  assert.equal(filterIsActive({ changes: { files: ['app/recording.tsx'] } }), true);
  const source = readFileSync(new URL('./zone-filter.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!filterIsActive\(context\)\) return \{ exclude: \{\} \}/);
});

test('a full campaign does not pass --changed-since, and e2e 0.22.0 skips filters without it', async () => {
  const { default: config } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  for (const name of ['testerarmy-dreamer', 'testerarmy-lucid', 'testerarmy-meditation', 'testerarmy-site', 'bugbash-repros']) {
    const check = config.checks.find(entry => entry.name === name);
    assert.equal(check.command.includes('--changed-since'), false, name);
  }
  const runner = readFileSync(new URL('./node_modules/e2e/dist/run/runner.js', import.meta.url), 'utf8');
  const at = runner.indexOf('changedSince === undefined');
  assert.ok(at > 0, 'e2e 0.22.0 listSelection short-circuits when --changed-since is absent');
  const slice = runner.slice(at, at + 280);
  assert.match(slice, /changedSince === undefined\s*\?\s*first/);
  assert.match(slice, /filterSelection/);
  const gate = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8');
  assert.match(gate, /args\[index\] === '--changed-since'/);
});

test('persona models stay the Terra act tier and the Sol judge', () => {
  assert.equal(PERSONA_ACT_MODEL, 'gpt-6.1-terra');
  assert.equal(PERSONA_ASSERT_MODEL, 'gpt-6.1-sol');
  const source = readFileSync(new URL('./dreamer-personas.ts', import.meta.url), 'utf8');
  assert.match(source, /const judge =/);
  assert.match(source, /PERSONA_ACT_MODEL/);
  assert.match(source, /PERSONA_ASSERT_MODEL/);
});

test('seven smoke journeys carry the smoke tag and a zone tag', () => {
  const files = {
    'tests/dreamer-journeys.web.e2e.ts': ['zone-capture', 'zone-sauvegarde'],
    'tests/dreamer-capture-save.web.e2e.ts': ['zone-sauvegarde'],
    'tests/dreamer-journal-filters.web.e2e.ts': ['zone-journal'],
    'tests/dreamer-billing.web.e2e.ts': ['zone-paiement'],
    'tests/dreamer-forgot-password.web.e2e.ts': ['zone-connexion'],
  };
  let smokeTags = 0;
  for (const [file, zones] of Object.entries(files)) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /'smoke'/);
    for (const zone of zones) assert.match(source, new RegExp(`'${zone}'`));
    smokeTags += source.split("'smoke'").length - 1;
  }
  assert.equal(smokeTags, 7);
});
