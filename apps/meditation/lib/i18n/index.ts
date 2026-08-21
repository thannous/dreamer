import { contentDe } from './content.de';
import { contentEn } from './content.en';
import { contentEs } from './content.es';
import { contentFr } from './content.fr';
import { contentIt } from './content.it';
import { contentPt } from './content.pt';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';

import type { AppLanguage } from '@/lib/types';

/**
 * Two catalogues per language: UI chrome and catalogue copy. They are merged
 * here so components only ever call one `t()`.
 */
const EN = { ...en, ...contentEn };

export type TranslationKey = keyof typeof EN;
export type TranslationValues = Record<string, string | number>;

/**
 * Typed as full records on purpose: a key added to English and forgotten in one
 * of the five others fails the build here, rather than surfacing as a raw key
 * on someone's screen.
 */
const CATALOGUES: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: EN,
  fr: { ...fr, ...contentFr },
  es: { ...es, ...contentEs },
  de: { ...de, ...contentDe },
  it: { ...it, ...contentIt },
  pt: { ...pt, ...contentPt },
};

const LANGUAGES = Object.keys(CATALOGUES) as AppLanguage[];

export const isAppLanguage = (value: string): value is AppLanguage =>
  (LANGUAGES as string[]).includes(value);

/** Replaces `{name}` placeholders. Missing values are left untouched. */
function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  values?: TranslationValues
): string {
  const catalogue = CATALOGUES[language] ?? EN;
  return interpolate(catalogue[key] ?? EN[key] ?? key, values);
}
