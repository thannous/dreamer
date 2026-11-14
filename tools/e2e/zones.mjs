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

/**
 * Paths the decision model never reads: internal docs and Markdown. No app
 * bundle loads them (metro.config.js assetExts has no md); revisit if it ever does.
 * @param {string} file
 */
export function sentToDecisionModel(file) {
  return !file.startsWith('doc_web_interne/') && !file.toLowerCase().endsWith('.md');
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
      'lib/recordingPermissions.ts',
      // On the web every Alert.alert of the capture (refused microphone, restart) is a browser dialog.
      'lib/browserAlert.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-capture-chat.web.e2e.ts',
      'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts',
      'tools/e2e/tests/dreamer-first-text-capture.web.e2e.ts',
      'tools/e2e/tests/dreamer-system-speech.web.e2e.ts',
      'tools/e2e/tests/dreamer-readiness.web.e2e.ts',
      'tools/e2e/tests/dreamer-review-accessibility.web.e2e.ts',
      'tools/e2e/tests/dreamer-web-dialogs.web.e2e.ts',
      'tools/e2e/tests/dreamer-visual-overflow.web.e2e.ts',
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
      'lib/dreamPersonalNotes.ts',
      'lib/journal/',
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
      'services/analysisPreviewService.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-journal-filters.web.e2e.ts',
      'tools/e2e/tests/dreamer-journal-margin.web.e2e.ts',
      'tools/e2e/tests/dreamer-image-retry.web.e2e.ts',
      'tools/e2e/tests/dreamer-personal-notes.web.e2e.ts',
      'tools/e2e/tests/dreamer-web-share.web.e2e.ts',
      'tools/e2e/tests/dreamer-analysis-preview.web.e2e.ts',
      'tools/e2e/tests/dreamer-dream-continuous-reading.web.e2e.ts',
      'tools/e2e/tests/dreamer-readiness.web.e2e.ts',
      'tools/e2e/tests/dreamer-review-accessibility.web.e2e.ts',
      'tools/e2e/tests/dreamer-native-large-text-polish.web.e2e.ts',
    ],
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
      'lib/revenuecat.ts',
      'lib/subscriptionErrors.ts',
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
      'components/guest/GuestAccountRow.tsx',
      'components/settings/',
      'context/AuthContext.tsx',
      'lib/auth',
      'lib/supabase.ts',
      'services/accountDeletionService.ts',
      'services/productOAuthSession.ts',
      'services/productOAuthNativeStorage.ts',
      'lib/appleAuth.ts',
      // Settings owns the reminder switches (dreamer-settings).
      'services/notificationService',
      'lib/reminderOptIn.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-forgot-password.web.e2e.ts',
      'tools/e2e/tests/dreamer-account-deletion.web.e2e.ts',
      'tools/e2e/tests/dreamer-security-url.web.e2e.ts',
      'tools/e2e/tests/dreamer-settings.web.e2e.ts',
    ],
  },
  {
    id: 'reflexion', tags: ['zone-reflexion'], product: 'dreamer', platform: 'web',
    sources: [
      'app/dream-chat/', 'app/dream-categories/', 'components/chat/',
      'context/ChatContext.tsx', 'hooks/useDreamChatSend.ts', 'hooks/useChat',
      'services/dreamChatSend.ts', 'lib/chat/',
      // The reading modal opens only from the reflection screen (app/dream-categories/[id].tsx).
      'components/analysis/AnalysisReadingModal.tsx', 'components/analysis/ImageGenerationDots.tsx',
      // The model client and the analysis it writes.
      'services/geminiService', 'services/journalAnalysis.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-chat-category.web.e2e.ts',
      'tools/e2e/tests/dreamer-reflection-context.web.e2e.ts',
      'tools/e2e/tests/dreamer-plus-channels.web.e2e.ts',
      'tools/e2e/tests/dreamer-analysis-preview.web.e2e.ts',
      'tools/e2e/tests/dreamer-ai-consent.web.e2e.ts',
    ],
  },
  {
    id: 'consentement-quota', tags: ['zone-consentement-quota'], product: 'dreamer', platform: 'web',
    sources: [
      'hooks/useQuota.ts', 'services/quota/', 'services/quotaService.ts',
      'components/quota/', 'components/privacy/', 'components/settings/useAiConsentController.ts',
      'lib/aiConsent', 'constants/limits.ts',
      'services/geminiService', 'services/journalAnalysis.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-ai-consent.web.e2e.ts',
      'tools/e2e/tests/dreamer-ai-consent-settings.web.e2e.ts',
      'tools/e2e/tests/dreamer-first-text-capture.web.e2e.ts',
      'tools/e2e/tests/dreamer-guest-limits.web.e2e.ts',
      'tools/e2e/tests/dreamer-billing.web.e2e.ts',
      'tools/e2e/tests/dreamer-analysis-preview.web.e2e.ts',
      'tools/e2e/tests/dreamer-web-dialogs.web.e2e.ts',
    ],
  },
  {
    id: 'exploration', tags: ['zone-exploration'], product: 'dreamer', platform: 'web',
    sources: [
      'app/(tabs)/explore.tsx', 'app/symbol-detail/', 'app/symbol-dictionary.tsx',
      'app/dream-guide/', 'app/dream-guides.tsx', 'app/collection.tsx',
      'components/symbols/', 'components/badges/', 'components/guides/', 'services/symbol',
      'services/dreamGuideService.ts', 'services/guideReading', 'services/badgeLedger', 'lib/badges/', 'lib/guideReading',
      'lib/dreamGuide',
    ],
    tests: [
      'tools/e2e/tests/dreamer-explorer-repertoire.web.e2e.ts',
      'tools/e2e/tests/dreamer-symbol-dictionary.web.e2e.ts',
      'tools/e2e/tests/dreamer-symbol-links.web.e2e.ts',
      'tools/e2e/tests/dreamer-guide-progress.web.e2e.ts',
      'tools/e2e/tests/dreamer-badge-collection.web.e2e.ts',
      'tools/e2e/tests/dreamer-guest-collection.web.e2e.ts',
      'tools/e2e/tests/dreamer-dream-guides.web.e2e.ts',
      'tools/e2e/tests/dreamer-visual-overflow.web.e2e.ts',
    ],
  },
  {
    id: 'lettre-recap', tags: ['zone-lettre-recap'], product: 'dreamer', platform: 'web',
    sources: ['app/moon-letter.tsx', 'app/weekly-recap.tsx', 'components/moon/', 'components/recap/',
      'components/home/HomeMoonLetterRow.tsx', 'components/home/HomeWeekNights.tsx', 'components/home/HomeRecurringCard.tsx',
      'services/moonLetterService.ts', 'lib/moonLetter.ts', 'lib/weeklyRecap.ts'],
    tests: ['tools/e2e/tests/dreamer-moon-letter.web.e2e.ts', 'tools/e2e/tests/dreamer-weekly-recap.web.e2e.ts',
      'tools/e2e/tests/dreamer-today-fomo.web.e2e.ts'],
  },
  {
    id: 'accueil', tags: ['zone-accueil'], product: 'dreamer', platform: 'web',
    sources: ['app/(tabs)/index.tsx', 'components/home/', 'components/quota/MonthEndAnalysesCard.tsx',
      'lib/todayState.ts', 'lib/dreamRediscovery.ts', 'lib/dreamAnniversary.ts', 'lib/monthEndAnalyses.ts',
      'lib/personalReading.ts', 'lib/fullMoon.ts', 'lib/weekConstellations.ts'],
    tests: ['tools/e2e/tests/dreamer-home-editorial.web.e2e.ts', 'tools/e2e/tests/dreamer-today-fomo.web.e2e.ts'],
  },
  {
    id: 'tendances', tags: ['zone-tendances'], product: 'dreamer', platform: 'web',
    // Each Trends door opens the journal through its filter link.
    sources: ['app/(tabs)/statistics.tsx', 'components/trends/', 'lib/dreamTrends.ts', 'lib/trendsSymbols.ts',
      'lib/dreamSky.ts', 'lib/fullMoon.ts', 'lib/weekConstellations.ts', 'lib/journalFilterLink.ts'],
    tests: ['tools/e2e/tests/dreamer-trends-editorial.web.e2e.ts', 'tools/e2e/tests/dreamer-today-fomo.web.e2e.ts'],
  },
  {
    id: 'onboarding', tags: ['zone-onboarding'], product: 'dreamer', platform: 'web',
    sources: ['app/onboarding.tsx', 'components/onboarding/', 'context/OnboardingContext.tsx', 'lib/onboardingState.ts'],
    // Settings replays the introduction and keeps a finished onboarding finished.
    tests: ['tools/e2e/tests/dreamer-onboarding-features.web.e2e.ts', 'tools/e2e/tests/dreamer-onboarding-features-stories.web.e2e.ts',
      'tools/e2e/tests/dreamer-onboarding-features-explorer.web.e2e.ts', 'tools/e2e/tests/dreamer-settings.web.e2e.ts'],
  },
  {
    id: 'navigation', tags: ['zone-navigation'], product: 'dreamer', platform: 'web',
    sources: ['app/(tabs)/_layout.tsx', 'components/navigation/', 'context/SideColumnTabBarContext.tsx',
      'context/ContentWindowContext.tsx', 'constants/layout.ts'],
    tests: ['tools/e2e/tests/dreamer-desktop-shell.web.e2e.ts', 'tools/e2e/tests/dreamer-visual-overflow.web.e2e.ts'],
  },
  {
    id: 'apparence', tags: ['zone-apparence'], product: 'dreamer', platform: 'web',
    // The palette is the colour source of the CSS and of every contextual background.
    sources: ['components/ui/DreamerBackground.tsx', 'components/ui/NightSkyBand.tsx',
      'components/inspiration/AtmosphericBackground.tsx', 'constants/dreamerArtwork.ts',
      'constants/noctaliaPalette.ts', 'context/ThemeContext.tsx'],
    tests: ['tools/e2e/tests/dreamer-backgrounds.web.e2e.ts', 'tools/e2e/tests/dreamer-settings.web.e2e.ts'],
  },
  {
    id: 'lucid',
    tags: ['zone-lucid'],
    product: 'lucid',
    platform: 'web',
    sources: ['routes/lucid/', 'components/lucid/', 'services/lucid'],
    tests: ['tools/e2e/tests/lucid.web.e2e.ts', 'tools/e2e/tests/lucid.ambience.web.e2e.ts', 'tools/e2e/tests/lucid.pr237.web.e2e.ts', 'tools/e2e/tests/lucid.sleep.web.e2e.ts'],
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

/**
 * Web journeys no zone selects on purpose, each with its reason. Every other
 * Dreamer, Lucid and Meditation web journey is listed in a zone or carries a
 * zone tag (zone-filter.test.mjs), so a new journey cannot become release-only
 * by omission.
 */
export const UNZONED = Object.freeze({
  'tools/e2e/tests/dreamer-release-guest.web.e2e.ts': 'régression large de toutes les surfaces, jouée par la campagne de release',
  'tools/e2e/tests/dreamer-release-story.web.e2e.ts': 'régression large de toutes les surfaces, jouée par la campagne de release',
  'tools/e2e/tests/dreamer-release-journal.web.e2e.ts': 'régression large de toutes les surfaces, jouée par la campagne de release',
  'tools/e2e/tests/dreamer-personas.web.e2e.ts': 'aucun test sans E2E_PERSONAS=1 : la campagne personas, facultative, appelle des modèles',
});

/**
 * A unit test or snapshot under an app folder: no bundle loads it, so it
 * starts no web journey (Jest runs it in verify:pr).
 * @param {string} file
 */
export function isUnitTestPath(file) {
  return file.includes('__tests__/') || /\.test\.[^/]+$/.test(file) || file.endsWith('.snap');
}

/**
 * What every web journey runs on: the app's dependencies and build config, and
 * the e2e runner with its shared helpers. A change here starts the smoke
 * journeys (about 25 s), the cheapest proof that the stack still drives the app.
 */
export const SMOKE_STACK = Object.freeze([
  'package.json', 'package-lock.json', 'patches/', 'app.json', 'app.config.ts', 'metro.config.js', 'babel.config.js',
  // The mock web app every Dreamer journey starts (npm run start:mock).
  '.env.mock', 'scripts/expo-safe-runner.js', 'global.css', 'mock-data/',
  'tools/e2e/package.json', 'tools/e2e/package-lock.json', 'tools/e2e/e2e.config.ts', 'tools/e2e/run.mjs',
  'tools/e2e/qualification.mjs', 'tools/e2e/web-ports.mjs', 'tools/e2e/web-engine.ts', 'tools/e2e/preload-web-matchers.mjs',
  'tools/e2e/traced-parity-test.ts', 'tools/e2e/web-journeys.ts', 'tools/e2e/web-parity-fixtures.ts', 'tools/e2e/web-fixtures.ts',
]);

/** @param {string} file */
export function isSmokeStackPath(file) {
  return SMOKE_STACK.some(path => (path.endsWith('/') ? file.startsWith(path) : file === path));
}

/**
 * A changed web journey of a release-only file (UNZONED) stays in the
 * release campaign: the PR gate does not run it for its own edit.
 * @param {string} file
 */
export function isUnzonedJourney(file) {
  return Object.hasOwn(UNZONED, file);
}

/**
 * Shared steps of web journeys, with the journeys that import them. A change to
 * one runs those journeys in the PR gate, as an edit to the journeys would.
 * zone-filter.test.mjs keeps each list equal to the files that import the module.
 */
export const SHARED_JOURNEY_STEPS = Object.freeze({
  'tools/e2e/web-journeys.ts': ['tools/e2e/tests/dreamer-billing.web.e2e.ts', 'tools/e2e/tests/dreamer-forgot-password.web.e2e.ts', 'tools/e2e/tests/dreamer-image-retry.web.e2e.ts', 'tools/e2e/tests/dreamer-journal-filters.web.e2e.ts', 'tools/e2e/tests/dreamer-journeys.web.e2e.ts', 'tools/e2e/tests/dreamer-locale-de.web.e2e.ts'],
  'tools/e2e/traced-parity-test.ts': ['tools/e2e/tests/dreamer-billing.web.e2e.ts', 'tools/e2e/tests/dreamer-capture-chat.web.e2e.ts', 'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts', 'tools/e2e/tests/dreamer-capture-save.web.e2e.ts', 'tools/e2e/tests/dreamer-first-text-capture.web.e2e.ts', 'tools/e2e/tests/dreamer-forgot-password.web.e2e.ts', 'tools/e2e/tests/dreamer-image-retry.web.e2e.ts', 'tools/e2e/tests/dreamer-journal-filters.web.e2e.ts', 'tools/e2e/tests/dreamer-journal-type-filter.web.e2e.ts', 'tools/e2e/tests/dreamer-journeys.web.e2e.ts', 'tools/e2e/tests/dreamer-locale-de.web.e2e.ts', 'tools/e2e/tests/dreamer-reflection-context.web.e2e.ts', 'tools/e2e/tests/dreamer-system-speech.web.e2e.ts'],
  'tools/e2e/onboarding-fixtures.ts': ['tools/e2e/tests/dreamer-onboarding-features.web.e2e.ts', 'tools/e2e/tests/dreamer-onboarding-features-explorer.web.e2e.ts', 'tools/e2e/tests/dreamer-onboarding-features-stories.web.e2e.ts'],
});

/**
 * The web journey files a changed file stands for: itself when it is a journey
 * the PR gate runs, the importers of a shared step, else none.
 * @param {string} file
 */
export function journeysOfChange(file) {
  if (Object.hasOwn(SHARED_JOURNEY_STEPS, file)) return SHARED_JOURNEY_STEPS[file];
  return file.startsWith('tools/e2e/tests/') && file.endsWith('.e2e.ts') && !isNativeJourney(file) && !isUnzonedJourney(file)
    ? [file] : [];
}

/** @param {string} source @param {string} file */
export function sourceMatches(source, file) {
  if (isUnitTestPath(file)) return false;
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
  if (isUnitTestPath(file)) return false;
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

/** Relevance a test filter gives a kept journey (e2e 0.23.1 bands at 0.75, 0.5 and 0.25). */
export const RELEVANCE_CHANGED_TEST = 1;
export const RELEVANCE_ZONE = 0.75;
export const RELEVANCE_UNSCORED = 0.5;

export function parcoursExclude(tests, files, locale) {
  const zones = zonesForFiles(files);
  const changedTests = new Set(files.flatMap(journeysOfChange));
  const tags = new Set(zones.flatMap(zone => zone.tags));
  const testFiles = new Set(zones.flatMap(zone => zone.tests));
  const exclude = {};
  const relevance = {};
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
    // e2e 0.23.1 starts the likeliest files first: a journey whose own file changed,
    // then the journeys of a touched zone. It never leaves a test out.
    else relevance[test.id] = changedTests.has(test.file) ? RELEVANCE_CHANGED_TEST : RELEVANCE_ZONE;
  }
  const names = zones.map(zone => zone.id);
  const note = names.length ? names.join(',') : changedTests.size ? 'tests-modifies' : 'aucun-parcours';
  return { exclude, relevance, note };
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
  const relevance = { ...zones.relevance };
  let kept = 0;
  for (const [id, reason] of Object.entries(zones.exclude)) {
    if (reason !== UNTOUCHED) exclude[id] = reason;
    else if (verdict.exclude[id] !== undefined) exclude[id] = `${UNTOUCHED} (modele : ${verdict.exclude[id]})`;
    else {
      kept += 1;
      // The model's own score for a parcours it brought back (decision 0.3.3), else the middle band.
      const score = verdict.relevance?.[id];
      relevance[id] = Number.isFinite(score) && score >= 0 && score <= 1 ? score : RELEVANCE_UNSCORED;
    }
  }
  const note = [zones.note, `modele : ${kept} parcours hors zone repris`, verdict.note].filter(Boolean).join('; ');
  return { exclude, relevance, note };
}
