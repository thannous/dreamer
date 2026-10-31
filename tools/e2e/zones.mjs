/**
 * Homemade zone map for the PR gate, without a model. Paths are
 * repository-relative POSIX paths, the same spelling `git diff --name-only`
 * and e2e's `--changed-since` use. A zone's tests run only when one of its sources
 * changed, unless the optional decision model below keeps them. Docs and
 * other non-app paths match nothing here.
 */

export const SMOKE_TAG = 'smoke';
export const BUGBASH_TAG = 'bugbash';
/** Why the zones leave out a parcours: the only reason the decision model may overturn. */
export const UNTOUCHED = 'le diff ne touche pas ce parcours';

/**
 * Optional decision model (the TesterArmy Filters API with OpenAI's Decisions
 * API). It judges only the parcours the zones leave out, so the zones stay the
 * floor. It needs an OpenAI key in the environment; without one the gate is
 * the zones alone, as before.
 */
export const DECISION_KEY_ENV = 'OPENAI_API_KEY';
export const DECISION_MODEL = 'gpt-6-luna';
/** Products whose journeys the model judges when a shared Dreamer path changes: Lucid runs on the same app code. */
export const DECISION_PRODUCTS = ['dreamer', 'lucid'];

/** @param {Record<string, string | undefined>} env */
export function decisionEnabled(env) {
  return Boolean(env[DECISION_KEY_ENV]?.trim());
}

/** Dreamer surfaces that should run the smoke tag, even with no named zone. */
export const DREAMER_APP_ROOTS = [
  'app/', 'components/', 'context/', 'hooks/', 'lib/', 'constants/', 'services/', 'routes/',
];

/**
 * @typedef {'dreamer'|'lucid'|'meditation'} Product
 * @typedef {{ id: string, tags: string[], product: Product, platform: 'web', sources: string[], tests: string[] }} Zone
 */

/** @type {readonly Zone[]} */
export const ZONES = [
  {
    id: 'capture',
    tags: ['zone-capture'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'app/recording.tsx',
      'app/(tabs)/add-dream.tsx',
      'components/recording/',
      'components/speech/',
      'components/chat/',
      'hooks/useCaptureConversation.ts',
      'hooks/useCaptureReviewPreparation.ts',
      'hooks/useRecordingSession.ts',
      'hooks/useRecordingDraftPersistence.ts',
      'hooks/useRecordingDraftScope.ts',
      'services/captureConversation.ts',
      'services/captureReviewPreparation.ts',
      'services/microphoneHold.ts',
      'services/nativeSpeechRecognition.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-capture-chat.web.e2e.ts',
      'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts',
      'tools/e2e/tests/dreamer-system-speech.web.e2e.ts',
    ],
  },
  {
    id: 'sauvegarde',
    tags: ['zone-sauvegarde'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'services/captureSave.ts',
      'hooks/useCaptureSave.ts',
      'hooks/useRecordingDraftPersistence.ts',
      'hooks/useRecordingDraftScope.ts',
      'services/storageService.ts',
      'services/storageServiceReal.ts',
      'services/journalRepository.ts',
      'services/journalRecordStore.ts',
    ],
    tests: ['tools/e2e/tests/dreamer-capture-save.web.e2e.ts'],
  },
  {
    id: 'journal',
    tags: ['zone-journal'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'app/journal/',
      'app/(tabs)/journal.tsx',
      'components/journal/',
      'lib/dreamFilters.ts',
      'lib/dreamLabels.ts',
      'lib/dreamUtils.ts',
      'lib/journalFilterLink.ts',
      'hooks/useDreamJournal.ts',
      'hooks/useDreamPersistence.ts',
      'hooks/useRemoteJournalList.ts',
      'hooks/useJournalListPagination.ts',
      'services/journalRepository.ts',
      'services/journalSyncEngine.ts',
      'services/journalAnalysis.ts',
      'services/journalDreamMapper.ts',
      'services/journalMediaUploadService.ts',
      'services/journalMutationTransport.ts',
      'services/journalNativeImageAdapter.ts',
    ],
    tests: ['tools/e2e/tests/dreamer-journal-filters.web.e2e.ts'],
  },
  {
    id: 'paiement',
    tags: ['zone-paiement'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'app/paywall.tsx',
      'components/subscription/',
      'components/quota/',
      'services/subscriptionService.ts',
      'services/subscriptionServiceReal.ts',
      'services/subscriptionSyncService.ts',
      'hooks/useSubscription',
      'context/SubscriptionContext.tsx',
      'services/quotaService.ts',
    ],
    tests: ['tools/e2e/tests/dreamer-billing.web.e2e.ts'],
  },
  {
    id: 'connexion',
    tags: ['zone-connexion'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'app/auth/',
      'app/settings.tsx',
      'components/auth/',
      'components/settings/',
      'context/AuthContext.tsx',
      'lib/auth',
      'lib/supabase.ts',
      'services/accountDeletionService.ts',
      'services/productOAuthSession.ts',
      'services/productOAuthNativeStorage.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-forgot-password.web.e2e.ts',
      'tools/e2e/tests/dreamer-account-deletion.web.e2e.ts',
      'tools/e2e/tests/dreamer-security-url.web.e2e.ts',
    ],
  },
  {
    id: 'reflexion', tags: ['zone-reflexion'], product: 'dreamer', platform: 'web',
    sources: [
      'app/dream-chat/', 'app/dream-categories/', 'components/chat/',
      'context/ChatContext.tsx', 'hooks/useDreamChatSend.ts', 'hooks/useChat',
      'services/dreamChatSend.ts', 'lib/chat/',
    ],
    tests: [
      'tools/e2e/tests/dreamer-chat-category.web.e2e.ts',
      'tools/e2e/tests/dreamer-reflection-context.web.e2e.ts',
      'tools/e2e/tests/dreamer-plus-channels.web.e2e.ts',
    ],
  },
  {
    id: 'consentement-quota', tags: ['zone-consentement-quota'], product: 'dreamer', platform: 'web',
    sources: [
      'hooks/useQuota.ts', 'services/quota/', 'services/quotaService.ts',
      'components/quota/', 'components/privacy/', 'components/settings/useAiConsentController.ts',
      'lib/aiConsent', 'constants/limits.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-ai-consent.web.e2e.ts',
      'tools/e2e/tests/dreamer-ai-consent-settings.web.e2e.ts',
      'tools/e2e/tests/dreamer-guest-limits.web.e2e.ts',
      'tools/e2e/tests/dreamer-billing.web.e2e.ts',
    ],
  },
  {
    id: 'exploration', tags: ['zone-exploration'], product: 'dreamer', platform: 'web',
    sources: [
      'app/(tabs)/explore.tsx', 'app/symbol-detail/', 'app/symbol-dictionary.tsx',
      'app/dream-guide/', 'app/dream-guides.tsx', 'app/collection.tsx',
      'components/symbols/', 'components/badges/', 'components/guides/', 'services/symbol',
      'services/dreamGuideService.ts', 'services/guideReading', 'services/badgeLedger', 'lib/badges/', 'lib/guideReading',
    ],
    tests: [
      'tools/e2e/tests/dreamer-explorer-repertoire.web.e2e.ts',
      'tools/e2e/tests/dreamer-symbol-dictionary.web.e2e.ts',
      'tools/e2e/tests/dreamer-symbol-links.web.e2e.ts',
      'tools/e2e/tests/dreamer-guide-progress.web.e2e.ts',
      'tools/e2e/tests/dreamer-badge-collection.web.e2e.ts',
      'tools/e2e/tests/dreamer-guest-collection.web.e2e.ts',
    ],
  },
  {
    id: 'lettre-recap', tags: ['zone-lettre-recap'], product: 'dreamer', platform: 'web',
    sources: ['app/moon-letter.tsx', 'app/weekly-recap.tsx', 'components/moon/', 'components/recap/',
      'components/home/HomeMoonLetterRow.tsx', 'components/home/HomeWeekNights.tsx', 'components/home/HomeRecurringCard.tsx',
      'services/moonLetterService.ts', 'lib/moonLetter.ts', 'lib/weeklyRecap.ts'],
    tests: ['tools/e2e/tests/dreamer-moon-letter.web.e2e.ts', 'tools/e2e/tests/dreamer-weekly-recap.web.e2e.ts'],
  },
  {
    id: 'lucid',
    tags: ['zone-lucid'],
    product: 'lucid',
    platform: 'web',
    sources: ['routes/lucid/', 'components/lucid/', 'services/lucid'],
    tests: ['tools/e2e/tests/lucid.web.e2e.ts'],
  },
  {
    id: 'meditation',
    tags: ['zone-meditation'],
    product: 'meditation',
    platform: 'web',
    sources: ['apps/meditation/'],
    tests: ['tools/e2e/tests/meditation.web.e2e.ts'],
  },
];

/** @param {string} source @param {string} file */
export function sourceMatches(source, file) {
  if (source.endsWith('/')) return file.startsWith(source);
  if (file === source) return true;
  if (!source.includes('.')) return file.startsWith(source);
  return false;
}

/** @param {readonly string[]} files */
export function zonesForFiles(files) {
  return ZONES.filter(zone => files.some(file => zone.sources.some(source => sourceMatches(source, file))));
}

/** @param {string} file */
export function isDreamerAppPath(file) {
  if (file.startsWith('routes/lucid/') || file.startsWith('components/lucid/') || file.startsWith('services/lucid')) return false;
  if (file.startsWith('apps/meditation/')) return false;
  return DREAMER_APP_ROOTS.some(root => file === root.slice(0, -1) || file.startsWith(root));
}

/** @param {string} file */
export function isNativeJourney(file) {
  return file.startsWith('tools/e2e/tests/') && (
    file.includes('.mobile.') || file.includes('.iphone-') || file.includes('native-performance')
  );
}

/**
 * Tests the zone filter leaves out. `tests[].file` is repository-relative.
 * Smoke and bug-bash tags are never part of this selection: smoke has its own
 * PR check, and bug-bash repros stay on the release step.
 * @param {readonly { id: string, tags: readonly string[], file: string }[]} tests
 * @param {readonly string[]} files
 */
/** True only when a run handed the filter a `--changed-since` change set. */
export function filterIsActive(context) {
  return Array.isArray(context?.changes?.files);
}

export function parcoursExclude(tests, files, locale) {
  const zones = zonesForFiles(files);
  const changedTests = new Set(files.filter(file => file.startsWith('tools/e2e/tests/') && file.endsWith('.e2e.ts') && !isNativeJourney(file)));
  const tags = new Set(zones.flatMap(zone => zone.tags));
  const testFiles = new Set(zones.flatMap(zone => zone.tests));
  const exclude = {};
  for (const test of tests) {
    const locales = test.tags.filter(tag => tag.startsWith('locale-'));
    if (locale && locales.length && !locales.includes(`locale-${locale}`)) {
      exclude[test.id] = 'ce parcours appartient à un autre contexte de langue';
      continue;
    }
    if (test.tags.includes(SMOKE_TAG)) {
      exclude[test.id] = 'la fumée PR joue ce parcours';
      continue;
    }
    if (test.tags.includes(BUGBASH_TAG)) {
      exclude[test.id] = 'bug bash hors porte PR';
      continue;
    }
    const tagged = test.tags.some(tag => tags.has(tag));
    const listed = testFiles.has(test.file) || changedTests.has(test.file);
    if (!tagged && !listed) exclude[test.id] = UNTOUCHED;
  }
  const names = zones.map(zone => zone.id);
  const note = names.length ? names.join(',') : changedTests.size ? 'tests-modifies' : 'aucun-parcours';
  return { exclude, note };
}

/**
 * Whether a `--changed-since` selection that runs nothing owes the PR gate nothing.
 * The engine lists static skips before applying the zone filter. Skips from a
 * different locale, untouched journeys, or the smoke check do not count. A
 * selected journey skipped in its own locale still fails the gate.
 * `pairs[].file` is relative to tools/e2e, as the engine lists it.
 * @param {readonly { id: string, tags: readonly string[], file: string, disposition: string }[]} pairs
 * @param {readonly string[]} files
 * @param {string | undefined} locale
 */
export function selectionOwesNothing(pairs, files, locale) {
  if (pairs.some(pair => pair.disposition === 'run')) return false;
  const skipped = pairs.filter(pair => pair.disposition === 'skip')
    .map(pair => ({ id: pair.id, tags: pair.tags, file: `tools/e2e/${pair.file}` }));
  const { exclude } = parcoursExclude(skipped, files, locale);
  return skipped.every(pair => exclude[pair.id] !== undefined);
}

/**
 * The zones' answer, widened by the model's. A parcours the zones leave out only
 * because the diff misses its zone runs unless the model also leaves it out.
 * Smoke and bug-bash exclusions stand: those tests have their own checks.
 * @param {{ exclude: Record<string, string>, note?: string }} zones
 * @param {{ exclude: Record<string, string>, note?: string }} verdict the model's answer about the parcours `UNTOUCHED` names
 */
export function widenWithDecision(zones, verdict) {
  const exclude = {};
  let kept = 0;
  for (const [id, reason] of Object.entries(zones.exclude)) {
    if (reason !== UNTOUCHED) exclude[id] = reason;
    else if (verdict.exclude[id] !== undefined) exclude[id] = `${UNTOUCHED} (modele : ${verdict.exclude[id]})`;
    else kept += 1;
  }
  const note = [zones.note, `modele : ${kept} parcours hors zone repris`, verdict.note].filter(Boolean).join('; ');
  return { exclude, note };
}
