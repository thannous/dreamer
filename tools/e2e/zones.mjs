/**
 * Homemade zone map for the PR gate. No model. Paths are repository-relative
 * POSIX paths, the same spelling `git diff --name-only` and e2e's
 * `--changed-since` use. A zone's tests run only when one of its sources
 * changed. Docs and other non-app paths match nothing here.
 */

export const SMOKE_TAG = 'smoke';
export const BUGBASH_TAG = 'bugbash';

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
      'services/captureConversation.ts',
      'services/captureReviewPreparation.ts',
      'services/microphoneHold.ts',
      'services/nativeSpeechRecognition.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-capture-chat.web.e2e.ts',
      'tools/e2e/tests/dreamer-capture-editor.web.e2e.ts',
    ],
  },
  {
    id: 'sauvegarde',
    tags: ['zone-sauvegarde'],
    product: 'dreamer',
    platform: 'web',
    sources: [
      'services/captureSave.ts',
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
      'services/accountDeletionService.ts',
      'services/productOAuthSession.ts',
      'services/productOAuthNativeStorage.ts',
    ],
    tests: [
      'tools/e2e/tests/dreamer-forgot-password.web.e2e.ts',
      'tools/e2e/tests/dreamer-account-deletion.web.e2e.ts',
    ],
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
export function parcoursExclude(tests, files) {
  const zones = zonesForFiles(files);
  const changedTests = new Set(files.filter(file => file.startsWith('tools/e2e/tests/') && file.endsWith('.e2e.ts') && !isNativeJourney(file)));
  const tags = new Set(zones.flatMap(zone => zone.tags));
  const testFiles = new Set(zones.flatMap(zone => zone.tests));
  const exclude = {};
  for (const test of tests) {
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
    if (!tagged && !listed) exclude[test.id] = 'le diff ne touche pas ce parcours';
  }
  const names = zones.map(zone => zone.id);
  const note = names.length ? names.join(',') : changedTests.size ? 'tests-modifies' : 'aucun-parcours';
  return { exclude, note };
}
