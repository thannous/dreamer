import { describe, expect, it } from '@jest/globals';

import { EMOTION_FAMILY_IDS } from '../dreamEmotions';
import { getEmotionFamilyLabel } from '../dreamLabels';
import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;

describe('getEmotionFamilyLabel', () => {
  it('[B] Given a family id When the label is resolved Then it goes through the stats.emotion.family namespace', () => {
    // THIS IS THE TEST THAT ENFORCES THE RECONCILIATION. The label map is module-private
    // (mirroring DREAM_THEME_LABEL_KEYS), so its coverage is proved through this loop
    // rather than through Object.keys: every canonical id must resolve, and it must resolve
    // under `stats.emotion.family.<id>`.
    // Revert: point any id at `stats.emotion.<id>` — that id fails by name, and the 12 x 6
    // translated strings would otherwise have gone dead silently.
    const t = (key: string) => `[[${key}]]`;

    for (const id of EMOTION_FAMILY_IDS) {
      expect(getEmotionFamilyLabel(id, t)).toBe(`[[stats.emotion.family.${id}]]`);
    }

    expect(EMOTION_FAMILY_IDS).toHaveLength(12);
  });

  it('[B] Given every family When the catalogue is loaded Then a real label resolves in all six languages', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const family of EMOTION_FAMILY_IDS) {
        const label = getEmotionFamilyLabel(family, t);

        expect(label).not.toBe(`stats.emotion.family.${family}`);
        expect(label).not.toBe(family);
        expect((label ?? '').trim()).not.toBe('');
      }
    }
  });

  it('[B] Given no family When the label is resolved Then it is undefined', () => {
    // Revert: drop the `if (!family)` guard — it returns '[[stats.emotion.family.undefined]]'.
    const t = (key: string) => `[[${key}]]`;

    expect(getEmotionFamilyLabel(null, t)).toBeUndefined();
    expect(getEmotionFamilyLabel(undefined, t)).toBeUndefined();
  });
});
