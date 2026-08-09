import { describe, expect, it } from '@jest/globals';

import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';

const RELEASE_NOTES_KEYS = [
  'release_notes.badge',
  'release_notes.title',
  'release_notes.subtitle',
  'release_notes.stats.title',
  'release_notes.stats.body',
  'release_notes.patterns.title',
  'release_notes.patterns.body',
  'release_notes.android.title',
  'release_notes.android.body',
  'release_notes.navigation.title',
  'release_notes.navigation.body',
  'release_notes.primary',
  'release_notes.later',
  'release_notes.close',
] as const;

describe('release notes translations', () => {
  it('covers the complete pop-in copy in every app language', () => {
    const languagePacks: [string, Record<string, string>][] = [
      ['en', en],
      ['fr', fr],
      ['es', es],
      ['de', de],
      ['it', italian],
    ];

    for (const [language, translations] of languagePacks) {
      for (const key of RELEASE_NOTES_KEYS) {
        expect({ language, key, value: translations[key] }).toMatchObject({
          language,
          key,
          value: expect.any(String),
        });
      }
      expect(translations['release_notes.badge']).toContain('{version}');
    }
  });
});
