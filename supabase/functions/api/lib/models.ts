/**
 * Single registry of the Gemini model identifiers used by the API.
 *
 * Every default lives here so a model upgrade is a one-line change and every
 * caller has an explicit model choice (chat can remain pinned for compatibility). Env overrides
 * (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `IMAGEN_PLUS_MODEL`, `IMAGEN_FREE_MODEL`,
 * …) are still honoured by the resolvers in `services/gemini.ts` and
 * `services/geminiImages.ts`, but a retired identifier is ignored so a stale
 * secret can never break production.
 */
export const GEMINI_MODELS = {
  text: {
    /** Primary text model for dream analysis. */
    default: 'gemini-3.8-flash',
    /** Short, non-interpretive questions during dream capture. */
    recall: 'gemini-3.8-flash',
    /** Cost-focused chat model selected independently from dream analysis. */
    chat: 'gemini-3.5-flash-lite',
    /** Cheaper fallback used when the primary model rejects or times out. */
    fallback: 'gemini-3.5-flash-lite',
  },
  image: {
    /** Plus-tier HD (2K/4K) illustrations; Lite renders 1K only. Replaces the deprecated gemini-3.1-flash-image. */
    default: 'gemini-nano-banana-2.1',
    /** Free / guest-tier illustrations. */
    lite: 'gemini-3.1-flash-lite-image',
  },
} as const;

/**
 * Claude models. Dream analysis runs on Claude when `ANTHROPIC_API_KEY` is set
 * and falls back to Gemini (`GEMINI_MODELS.text`) on any failure; without the
 * key, analysis stays on Gemini.
 */
export const CLAUDE_MODELS = {
  /** Medium effort: complete referral and injection refusals, about 10 s (synthetic test, 2026-10-15). */
  analysis: { model: 'claude-haiku-5-5', effort: 'medium' },
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
