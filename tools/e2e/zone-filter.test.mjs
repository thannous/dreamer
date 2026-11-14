import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PERSONA_ACT_MODEL, PERSONA_ASSERT_MODEL, personaModels, personaEnvironment } from './persona-models.mjs';
import { qualifyingSdkEnvironment } from './qualification.mjs';
// The test ID check joins this file, which verify:pr already runs whenever app code
// changes, instead of a new check or package.json script.
import './test-ids.test.mjs';
import { DECISION_KEY_ENV, DECISION_MODEL, RELEVANCE_CHANGED_TEST, RELEVANCE_UNSCORED, RELEVANCE_ZONE, SHARED_JOURNEY_STEPS, UNTOUCHED, UNZONED, ZONES, decisionEnabled, filterIsActive, isDreamerAppPath, isNativeJourney, parcoursExclude, selectionOwesNothing, sentToDecisionModel, widenWithDecision, zonesForFiles } from './zones.mjs';

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

test('a selected static skip is owed only in its own locale', () => {
  const french = { id: 'dictionary-fr', tags: ['locale-fr-FR'], file: 'tests/dreamer-symbol-dictionary.web.e2e.ts', disposition: 'skip' };
  const files = ['tools/e2e/tests/dreamer-symbol-dictionary.web.e2e.ts'];
  assert.equal(selectionOwesNothing([french], files, 'en-US'), true);
  assert.equal(selectionOwesNothing([french], files, 'fr-FR'), false);
  assert.equal(selectionOwesNothing([{ ...french, disposition: 'run' }], files, 'fr-FR'), false);
});

test('journal filter and label dependencies select the journal journeys', () => {
  for (const file of ['lib/dreamFilters.ts', 'lib/dreamLabels.ts', 'lib/dreamUtils.ts', 'lib/journalFilterLink.ts']) {
    assert.ok(zonesForFiles([file]).some(zone => zone.id === 'journal'), file);
    assert.equal(parcoursExclude([{ id: 'journal-filter', tags: [], file: 'tools/e2e/tests/dreamer-journal-filters.web.e2e.ts' }], [file]).exclude['journal-filter'], undefined, file);
  }
});

test('the zone filter stays inactive unless --changed-since supplied changes', () => {
  assert.equal(filterIsActive(undefined), false);
  assert.equal(filterIsActive({}), false);
  assert.equal(filterIsActive({ changes: {} }), false);
  assert.equal(filterIsActive({ changes: { files: ['app/recording.tsx'] } }), true);
  const source = readFileSync(new URL('./zone-filter.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!filterIsActive\(context\)\) return \{ exclude: \{\} \}/);
});

test('a full campaign does not pass --changed-since, and e2e 0.23 skips filters without it', async () => {
  const { default: config } = await import(new URL('../../verify-local.config.mjs', import.meta.url).href);
  for (const name of ['testerarmy-dreamer', 'testerarmy-lucid', 'testerarmy-meditation', 'testerarmy-site', 'bugbash-repros']) {
    const check = config.checks.find(entry => entry.name === name);
    assert.equal(check.command.includes('--changed-since'), false, name);
  }
  const runner = readFileSync(new URL('./node_modules/e2e/dist/run/runner.js', import.meta.url), 'utf8');
  const at = runner.indexOf('changedSince === undefined');
  assert.ok(at > 0, 'e2e 0.23 listSelection short-circuits when --changed-since is absent');
  const slice = runner.slice(at, at + 280);
  assert.match(slice, /changedSince === undefined\s*\?\s*first/);
  assert.match(slice, /filterSelection/);
  const gate = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8');
  assert.match(gate, /args\[index\] === '--changed-since'/);
});

test('a leftover test.only fails the gate\'s e2e 0.23 selection instead of narrowing it', async () => {
  const { isCiMode } = await import('./node_modules/e2e/dist/config/resolve.js');
  const { select } = await import('./node_modules/e2e/dist/collect/select.js');
  // A caller that turned CI off still hands the SDK child CI mode.
  const ci = isCiMode(qualifyingSdkEnvironment({ CI: 'false' }));
  assert.equal(ci, true);
  const leftover = { tests: [{ id: 'leftover-only', mode: 'only', selected: true }] };
  assert.throws(() => select(leftover, { ci, targets: [] }), { code: 'ONLY_IN_CI' });
});

test('the decision model only takes back parcours the zones left out as untouched', () => {
  const zones = parcoursExclude(suite, ['app/journal/[id].tsx']);
  assert.equal(zones.exclude.home, UNTOUCHED);
  assert.equal(zones.exclude.capture, UNTOUCHED);
  // The model keeps `home`, leaves `capture` out, and its answer about smoke or bug bash would not count.
  const widened = widenWithDecision(zones, { exclude: { capture: '4% likely affected', 'billing-smoke': '1% likely affected' }, note: '1 call, 9.1k tokens, $0.0004' });
  assert.equal(widened.exclude.journal, undefined);
  assert.equal(widened.exclude.home, undefined);
  assert.equal(widened.exclude.capture, `${UNTOUCHED} (modele : 4% likely affected)`);
  assert.equal(widened.exclude['billing-smoke'], 'la fumée PR joue ce parcours');
  assert.equal(widened.exclude.bug, 'bug bash hors porte PR');
  assert.equal(widened.note, 'journal; modele : 2 parcours hors zone repris; 1 call, 9.1k tokens, $0.0004');
});

test('kept parcours carry a relevance so the likeliest run first, and a left-out one has none', () => {
  const zones = parcoursExclude(suite, ['app/journal/[id].tsx']);
  assert.equal(zones.relevance.journal, RELEVANCE_ZONE);
  assert.equal(zones.relevance.home, undefined);
  const changedFile = suite.find(test => test.id === 'home').file;
  assert.equal(parcoursExclude(suite, [changedFile]).relevance.home, RELEVANCE_CHANGED_TEST);
  // The model's score for a parcours it brings back; none, or one out of range, is the middle band.
  const scored = widenWithDecision(zones, { exclude: {}, relevance: { home: 0.31, capture: 7 } });
  assert.equal(scored.relevance.journal, RELEVANCE_ZONE);
  assert.equal(scored.relevance.home, 0.31);
  assert.equal(scored.relevance.capture, RELEVANCE_UNSCORED);
  assert.equal(scored.relevance['billing-smoke'], undefined);
  for (const score of Object.values(scored.relevance)) assert.ok(score >= 0 && score <= 1);
});

test('the decision model is off without an OpenAI key and is OpenAI\'s decision model', () => {
  assert.equal(DECISION_KEY_ENV, 'OPENAI_API_KEY');
  assert.equal(decisionEnabled({}), false);
  assert.equal(decisionEnabled({ OPENAI_API_KEY: ' ' }), false);
  assert.equal(decisionEnabled({ OPENAI_API_KEY: 'sk-test' }), true);
  assert.equal(DECISION_MODEL, 'gpt-6-luna');
  const source = readFileSync(new URL('./decision-verdict.mjs', import.meta.url), 'utf8');
  assert.match(source, /openai\.decisionModel\(DECISION_MODEL\)/);
});

test('internal docs and Markdown stay out of the model\'s diff; app code and lockfiles, which keep every parcours, stay in', () => {
  assert.equal(sentToDecisionModel('doc_web_interne/docs/security/audit.example.json'), false);
  assert.equal(sentToDecisionModel('specs/a.md'), false);
  assert.equal(sentToDecisionModel('package-lock.json'), true);
  assert.equal(sentToDecisionModel('components/ui/Toast.tsx'), true);
});

test('the zone filter keeps the zones when the model is off or cannot answer', async () => {
  const { parcoursTouches } = await import('./zone-filter.ts');
  const root = '/nonexistent/noctalia';
  const candidates = [
    { id: 'journal', file: 'tests/dreamer-journal-filters.web.e2e.ts', titlePath: ['journal'], tags: ['zone-journal'] },
    { id: 'home', file: 'tests/dreamer-home-editorial.web.e2e.ts', titlePath: ['home'], tags: ['historical-parity'] },
  ];
  const context = {
    projectRoot: `${root}/tools/e2e`, changes: { base: 'base', root, files: ['app/journal/[id].tsx'] },
    signal: new AbortController().signal, log() {}, redact: text => text,
  };
  const saved = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    assert.deepEqual(await parcoursTouches.filter(candidates, context), { exclude: { home: UNTOUCHED }, relevance: { journal: RELEVANCE_ZONE }, note: 'journal' });
    // With a key, a model that cannot even start (here: no repository) leaves the zones' answer, and says so.
    process.env.OPENAI_API_KEY = 'sk-test';
    const fallback = await parcoursTouches.filter(candidates, context);
    assert.deepEqual(fallback.exclude, { home: UNTOUCHED });
    assert.deepEqual(fallback.relevance, { journal: RELEVANCE_ZONE });
    assert.match(fallback.note, /^journal; modele indisponible \(.+\), zones seules$/);
    // Nothing left out as untouched: nothing to ask.
    assert.deepEqual(await parcoursTouches.filter(candidates.slice(0, 1), context), { exclude: {}, relevance: { journal: RELEVANCE_ZONE }, note: 'journal' });
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
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

// The engine's own collection, with no browser and no app: each test with its resolved
// tags, describe and fixture levels included. A source scan cannot tell which test a tag is on.
function collectedWebTests(product) {
  // Each product's own default locale: other-locale tests are still listed, as skips.
  const inherited = { ...process.env };
  delete inherited.E2E_WEB_LOCALE;
  const result = spawnSync(process.execPath, ['--import', './preload-web-matchers.mjs', 'node_modules/e2e/dist/cli/bin.js', 'list', '--reporter', 'json'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)), encoding: 'utf8',
    env: { ...inherited, E2E_PRODUCT: product, E2E_PLATFORM: 'web', E2E_PERSONAS: '0', E2E_BUGBASH: '0',
      E2E_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', CI: '1', NO_COLOR: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).pairs;
}

test('every web journey is reachable by a zone, or kept release-only with a reason', () => {
  const zoneTags = new Set(ZONES.flatMap(zone => zone.tags));
  const listed = new Set(ZONES.flatMap(zone => zone.tests));
  const files = new Set();
  for (const product of ['dreamer', 'lucid', 'meditation']) {
    for (const pair of collectedWebTests(product)) {
      const file = `tools/e2e/${pair.file}`;
      if (!/^tools\/e2e\/tests\/(dreamer|lucid|meditation)[^/]*\.web\.e2e\.ts$/.test(file)) continue;
      files.add(file);
      if (listed.has(file) || Object.hasOwn(UNZONED, file)) continue;
      // Smoke tests run in their own gate and bug-bash repros in verify:release; the parcours
      // selects a test of an unlisted file only through one of its zone tags.
      assert.ok(pair.tags.some(tag => tag === 'smoke' || tag === 'bugbash' || zoneTags.has(tag)),
        `${pair.file} › ${pair.title}: no zone reaches it; tag it with its zone or list the file in UNZONED`);
    }
  }
  assert.ok(files.size > 40);
  for (const [file, reason] of Object.entries(UNZONED)) {
    assert.ok(existsSync(new URL(`../../${file}`, import.meta.url)), file);
    assert.ok(reason.trim(), file);
    assert.equal(listed.has(file), false, `${file} must be zoned or listed in UNZONED, not both`);
  }
  // A renamed journey must not silently drop out of its zone.
  for (const file of listed) assert.ok(existsSync(new URL(`../../${file}`, import.meta.url)), file);
});

test('changes in behavioral owners select their journeys without selecting unrelated billing', () => {
  const cases = [
    ['hooks/useCaptureConversation.ts', 'dreamer-capture-chat.web.e2e.ts'],
    ['hooks/useCaptureSave.ts', 'dreamer-capture-save.web.e2e.ts'],
    ['hooks/useRecordingDraftScope.ts', 'dreamer-capture-save.web.e2e.ts'],
    ['hooks/useDreamChatSend.ts', 'dreamer-reflection-context.web.e2e.ts'],
    ['services/dreamChatSend.ts', 'dreamer-chat-category.web.e2e.ts'],
    ['components/chat/MessagesList.tsx', 'dreamer-plus-channels.web.e2e.ts'],
    ['services/nativeSpeechRecognition.ts', 'dreamer-system-speech.web.e2e.ts'],
    ['lib/auth.web.ts', 'dreamer-forgot-password.web.e2e.ts'],
    ['lib/supabase.ts', 'dreamer-security-url.web.e2e.ts'],
    ['app/symbol-detail/[id].tsx', 'dreamer-symbol-links.web.e2e.ts'],
    ['app/moon-letter.tsx', 'dreamer-moon-letter.web.e2e.ts'],
    ['lib/moonLetter.ts', 'dreamer-moon-letter.web.e2e.ts'],
    ['lib/weeklyRecap.ts', 'dreamer-weekly-recap.web.e2e.ts'],
    ['components/recap/WeeklyRecapScreen.tsx', 'dreamer-weekly-recap.web.e2e.ts'],
    ['lib/guideReading.ts', 'dreamer-guide-progress.web.e2e.ts'],
    ['components/guides/GuideReadingHost.tsx', 'dreamer-guide-progress.web.e2e.ts'],
    ['components/analysis/AnalysisReadingModal.tsx', 'dreamer-reflection-context.web.e2e.ts'],
    ['components/guides/GuideReadingHost.tsx', 'dreamer-dream-guides.web.e2e.ts', 'fr-FR'],
    ['app/settings.tsx', 'dreamer-settings.web.e2e.ts', 'fr-FR'],
    ['components/journal/DreamShareSheet.tsx', 'dreamer-web-share.web.e2e.ts'],
    ['components/journal/DreamPersonalNotes.tsx', 'dreamer-personal-notes.web.e2e.ts'],
    ['lib/dreamPersonalNotes.ts', 'dreamer-personal-notes.web.e2e.ts'],
    ['services/analysisPreviewService.ts', 'dreamer-analysis-preview.web.e2e.ts'],
    ['app/(tabs)/journal.tsx', 'dreamer-native-large-text-polish.web.e2e.ts', 'fr-FR'],
    ['lib/browserAlert.ts', 'dreamer-web-dialogs.web.e2e.ts'],
    ['components/home/TodayHero.tsx', 'dreamer-home-editorial.web.e2e.ts'],
    ['components/trends/TrendsSky.tsx', 'dreamer-trends-editorial.web.e2e.ts'],
    ['lib/onboardingState.ts', 'dreamer-onboarding-features.web.e2e.ts'],
    ['components/navigation/DesktopSidebar.tsx', 'dreamer-desktop-shell.web.e2e.ts'],
    ['components/ui/DreamerBackground.tsx', 'dreamer-backgrounds.web.e2e.ts', 'fr-FR'],
  ];
  for (const [source, file, locale] of cases) {
    // A French-only journey is selected in its own French context.
    const expected = { id: 'expected', file: `tools/e2e/tests/${file}`, tags: locale ? [`locale-${locale}`] : [] };
    const selection = parcoursExclude([expected, billing, bug], [source], locale);
    assert.equal(selection.exclude.expected, undefined, source);
    assert.ok(selection.exclude.billing, source);
    assert.ok(selection.exclude.bug, source);
  }
  for (const source of ['hooks/useSubscription.ts', 'hooks/useSubscriptionExpiryTimer.ts', 'hooks/useQuota.ts',
    'lib/revenuecat.ts', 'lib/subscriptionErrors.ts']) {
    assert.equal(parcoursExclude([billing], [source]).exclude.billing, undefined, source);
  }
});

test('release-sensitive Dreamer sources select the journeys that exercise them', () => {
  const cases = [
    ['lib/appleAuth.ts', 'dreamer-forgot-password.web.e2e.ts'],
    ['services/notificationServiceReal.ts', 'dreamer-settings.web.e2e.ts'],
    ['lib/reminderOptIn.ts', 'dreamer-settings.web.e2e.ts'],
    ['lib/recordingPermissions.ts', 'dreamer-capture-chat.web.e2e.ts'],
    ['services/geminiService.ts', 'dreamer-reflection-context.web.e2e.ts'],
    ['services/geminiServiceReal.ts', 'dreamer-ai-consent.web.e2e.ts'],
    ['services/journalAnalysis.ts', 'dreamer-analysis-preview.web.e2e.ts'],
    ['services/journalAnalysis.ts', 'dreamer-guest-limits.web.e2e.ts'],
  ];
  for (const [source, file] of cases) {
    const expected = { id: 'expected', file: `tools/e2e/tests/${file}`, tags: [] };
    assert.equal(parcoursExclude([expected, bug], [source]).exclude.expected, undefined, `${source} -> ${file}`);
  }
});

test('a unit test or snapshot next to app code selects no zone and is not app code', () => {
  for (const file of ['hooks/useSubscription.test.tsx', 'lib/__tests__/dreamUtils.test.ts',
    'components/journal/__tests__/__snapshots__/DreamCard.test.tsx.snap', 'apps/meditation/app/__tests__/index.test.tsx']) {
    assert.deepEqual(zonesForFiles([file]), [], file);
    assert.equal(isDreamerAppPath(file), false, file);
  }
  assert.deepEqual(zonesForFiles(['hooks/useSubscription.ts']).map(zone => zone.id), ['paiement']);
});

test('a changed release-only journey file is not a parcours the PR gate owes', () => {
  for (const file of Object.keys(UNZONED)) {
    const broad = { id: 'broad', tags: [], file };
    const decision = parcoursExclude([broad], [file]);
    assert.equal(decision.exclude.broad, UNTOUCHED, file);
    assert.equal(decision.note, 'aucun-parcours', file);
  }
});

test('the guest account row selects the journey that opens account creation from it', () => {
  const row = { id: 'row', tags: ['zone-connexion'], file: 'tools/e2e/tests/dreamer-journeys.web.e2e.ts' };
  assert.equal(parcoursExclude([row], ['components/guest/GuestAccountRow.tsx']).exclude.row, undefined);
});

test('a French-only selected journey runs in French rather than becoming an English skipped pass', () => {
  const french = { id: 'letter', file: 'tools/e2e/tests/dreamer-moon-letter.web.e2e.ts', tags: ['locale-fr-FR'] };
  const files = ['app/moon-letter.tsx'];
  assert.ok(parcoursExclude([french], files, 'en-US').exclude.letter);
  assert.equal(parcoursExclude([french], files, 'fr-FR').exclude.letter, undefined);
  assert.ok(parcoursExclude([french], ['app/paywall.tsx'], 'fr-FR').exclude.letter);
});

test('the rerun environment preserves both effective models, including judge overrides', () => {
  const env = { E2E_PERSONA_ACT_MODEL: 'actor', E2E_PERSONA_JUDGE_MODEL: 'judge' };
  assert.deepEqual(personaModels(personaEnvironment(env)), personaModels(env));
  assert.equal(personaModels({ ...env, E2E_PERSONA_MODEL: ' override ' }).personaModel, 'override');
  assert.deepEqual(personaModels({ E2E_PERSONA_MODEL: ' ', E2E_PERSONA_JUDGE_MODEL: ' ' }),
    { personaModel: PERSONA_ACT_MODEL, personaJudgeModel: PERSONA_ASSERT_MODEL });
});

test('the decision model cannot revive a journey in the wrong locale', () => {
  const french = { id: 'fr-capture', tags: ['zone-capture', 'locale-fr-FR'], file: 'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts' };
  const zones = parcoursExclude([french], ['app/recording.tsx'], 'en-US');
  assert.equal(zones.exclude[french.id], 'ce parcours appartient à un autre contexte de langue');
  assert.equal(widenWithDecision(zones, { exclude: {} }).exclude[french.id], zones.exclude[french.id]);
});

test('each shared journey step lists exactly the gated web journeys that import it, and a change to it runs them', () => {
  const tests = new URL('./tests/', import.meta.url);
  const journeys = readdirSync(tests).filter(name => name.endsWith('.web.e2e.ts'));
  for (const [step, listed] of Object.entries(SHARED_JOURNEY_STEPS)) {
    const module = step.slice('tools/e2e/'.length).replace(/\.ts$/, '');
    const importers = journeys.filter(name => readFileSync(new URL(name, tests), 'utf8').includes(`from '../${module}'`))
      .map(name => `tools/e2e/tests/${name}`).filter(file => !Object.hasOwn(UNZONED, file)).sort();
    assert.deepEqual([...listed].sort(), importers, step);
    const journey = { id: 'shared', tags: [], file: listed[0] };
    assert.equal(parcoursExclude([journey], [step]).exclude.shared, undefined, step);
  }
});

test('the lucid zone names every Lucid web journey file the config and the gate select', () => {
  const dir = fileURLToPath(new URL('./tests/', import.meta.url));
  const files = readdirSync(dir).filter(name => /^lucid\.([a-z0-9]+\.)?web\.e2e\.ts$/.test(name)).map(name => `tools/e2e/tests/${name}`).sort();
  assert.ok(files.length > 1);
  assert.deepEqual([...ZONES.find(zone => zone.id === 'lucid').tests].sort(), files);
});

// A journey raises a `restore` flag before it changes a device-wide setting; only the
// afterEach hook puts the setting back when the journey fails or times out.
test('every native journey file that uses the restore flags registers the restore hook', () => {
  const dir = fileURLToPath(new URL('./tests/', import.meta.url));
  const using = readdirSync(dir).filter(name => name.endsWith('.e2e.ts'))
    .filter(name => /\brestore\b[^;]*from '\.\.\/dreamer-native-fixtures'/.test(readFileSync(dir + name, 'utf8')));
  assert.ok(using.length > 0);
  for (const name of using) assert.match(readFileSync(dir + name, 'utf8'), /^afterEach\(restoreDeviceSettings\);$/m, name);
});
