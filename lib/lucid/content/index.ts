import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import it from './it';
import type { LucidLocale, LucidTrainerContent } from './types';

export * from './references';
export * from './types';

export const LUCID_CONTENT = {
  en,
  fr,
  es,
  de,
  it,
} as const satisfies Readonly<Record<LucidLocale, LucidTrainerContent>>;

export function normalizeLucidLocale(locale?: string | null): LucidLocale {
  const normalized = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return normalized === 'fr' ||
    normalized === 'es' ||
    normalized === 'de' ||
    normalized === 'it'
    ? normalized
    : 'en';
}

export function getLucidContent(locale?: string | null): LucidTrainerContent {
  return LUCID_CONTENT[normalizeLucidLocale(locale)];
}
