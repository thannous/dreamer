import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PERSONA_ACT_MODEL, PERSONA_ASSERT_MODEL } from './persona-models.mjs';
import { isDreamerAppPath, isNativeJourney, parcoursExclude, zonesForFiles } from './zones.mjs';

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
