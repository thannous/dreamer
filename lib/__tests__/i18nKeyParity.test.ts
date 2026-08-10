import { describe, expect, it } from '@jest/globals';

import dePack from '../i18n/de';
import enPack from '../i18n/en';
import esPack from '../i18n/es';
import frPack from '../i18n/fr';
// Aliased: a bare `it` import collides with the jest global of the same name.
import itPack from '../i18n/it';
import ptPack from '../i18n/pt';

/**
 * Strict key-set parity across the six packs.
 *
 * This is the only guard against a new string landing in five catalogues instead of six:
 * the app falls back to the key itself, so a missing German key ships as
 * `stats.emotions.locked.body` rendered on screen, and no screen test would catch it because
 * screen tests run under a marker translator.
 *
 * Both set differences are asserted (rather than a length equality) so the failure message
 * names the offending key.
 */
const packs = { fr: frPack, es: esPack, de: dePack, it: itPack, pt: ptPack } as const;

describe('i18n key parity', () => {
  const reference = Object.keys(enPack).sort();

  it.each(Object.keys(packs) as (keyof typeof packs)[])(
    'keeps the %s catalogue key-for-key identical to en',
    (language: keyof typeof packs) => {
      const keys = Object.keys(packs[language]).sort();

      expect(reference.filter((key) => !keys.includes(key))).toEqual([]);
      expect(keys.filter((key) => !reference.includes(key))).toEqual([]);
    }
  );

  it.each(Object.keys(packs) as (keyof typeof packs)[])(
    'keeps the %s catalogue placeholders identical to en for every key',
    (language: keyof typeof packs) => {
      const placeholdersOf = (value: string): string[] =>
        [...value.matchAll(/\{\{?\s*([a-zA-Z_]+)\s*\}?\}/g)].map((match) => match[1]).sort();

      for (const key of reference) {
        expect(placeholdersOf(packs[language][key])).toEqual(placeholdersOf(enPack[key]));
      }
    }
  );
});
