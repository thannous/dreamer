/**
 * Single registry of the Gemini model identifiers used by the API.
 *
 * Every default lives here so a model upgrade is a one-line change and every
 * caller (analysis, categorisation, chat, images) moves together. Env overrides
 * (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `IMAGEN_PLUS_MODEL`, `IMAGEN_FREE_MODEL`,
 * …) are still honoured by the resolvers in `services/gemini.ts` and
 * `services/geminiImages.ts`, but a retired identifier is ignored so a stale
 * secret can never break production.
 */
export const GEMINI_MODELS = {
  text: {
    /** Primary text model for analysis, categorisation and chat. */
    default: 'gemini-3.7-flash',
    /** Cheaper fallback used when the primary model rejects or times out. */
    fallback: 'gemini-3.5-flash-lite',
  },
  image: {
    /** Plus-tier dream illustrations. */
    default: 'gemini-3.1-flash-image',
    /** Free / guest-tier illustrations. */
    lite: 'gemini-3.1-flash-lite-image',
  },
} as const;

/** Text previews that were retired from the Interactions API (404 on request). */
export const RETIRED_TEXT_PREVIEW_MODELS: ReadonlySet<string> = new Set([
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
]);

/** Image previews that were retired; env overrides pointing at them are ignored. */
export const RETIRED_IMAGE_MODELS: ReadonlySet<string> = new Set([
  'gemini-2.5-flash-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
]);
