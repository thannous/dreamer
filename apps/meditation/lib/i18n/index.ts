import { contentEn } from './content.en';
import { contentFr } from './content.fr';
import { en } from './en';
import { fr } from './fr';

import type { AppLanguage, ShippedLanguage } from '@/lib/types';

/**
 * Two catalogues per language: UI chrome (`en`/`fr`) and catalogue copy
 * (`content.*`). They are merged here so components only ever call one `t()`.
 */
const EN = { ...en, ...contentEn };

export type TranslationKey = keyof typeof EN;
export type TranslationValues = Record<string, string | number>;

// Typed as a full record on purpose: a key added to English and forgotten in
// French fails the build here rather than surfacing as a raw key at runtime.
const FR: Record<TranslationKey, string> = { ...fr, ...contentFr };

const CATALOGUES: Record<ShippedLanguage, Record<TranslationKey, string>> = { en: EN, fr: FR };

export const isShippedLanguage = (value: string): value is ShippedLanguage =>
  value === 'en' || value === 'fr';

/**
 * Resolves any of the six target languages onto a catalogue that actually
 * exists today. The other four land in L8; until then they fall back to English
 * rather than showing raw keys.
 */
export function resolveLanguage(language: AppLanguage): ShippedLanguage {
  return isShippedLanguage(language) ? language : 'en';
}

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
  const catalogue = CATALOGUES[resolveLanguage(language)];
  return interpolate(catalogue[key] ?? EN[key] ?? key, values);
}
