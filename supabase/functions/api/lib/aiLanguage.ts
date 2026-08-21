/**
 * Single source of truth for the languages the AI pipeline can answer in.
 *
 * Every prompt that names a language, or that carries localized wording, reads
 * from here. This list used to be re-declared inline in four places with four
 * different coverages, which is how Portuguese users ended up receiving English
 * interpretations while the client was faithfully sending `lang: 'pt'`.
 */
export const AI_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;

export type AiLanguage = (typeof AI_LANGUAGES)[number];

const AI_LANGUAGE_SET: ReadonlySet<string> = new Set(AI_LANGUAGES);

export const isAiLanguage = (value: string): value is AiLanguage => AI_LANGUAGE_SET.has(value);

/**
 * Names injected into prompts to tell the model which language to write in.
 * `pt` is deliberately "Brazilian Portuguese": the app catalogues, the store
 * listing and the marketing site all target pt-BR.
 */
const AI_LANGUAGE_NAMES: Record<AiLanguage, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Brazilian Portuguese',
};

export const aiLanguageName = (lang: string): string =>
  isAiLanguage(lang) ? AI_LANGUAGE_NAMES[lang] : AI_LANGUAGE_NAMES.en;

/**
 * Picks the entry for `lang`, falling back to English for anything unknown.
 * Typing the table as a full `Record<AiLanguage, T>` makes a forgotten language
 * a compile error rather than a silent fallback to English at runtime.
 */
export const localizedForAi = <T>(lang: string, byLanguage: Record<AiLanguage, T>): T =>
  isAiLanguage(lang) ? byLanguage[lang] : byLanguage.en;
