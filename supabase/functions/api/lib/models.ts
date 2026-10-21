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
 * Claude models. Text features (analysis, chat, categorization, recall) run on
 * Claude when `ANTHROPIC_API_KEY` is set and fall back to Gemini
 * (`GEMINI_MODELS.text`) on any failure; without the key they stay on Gemini.
 * Images stay on Gemini. Each `timeoutMs` leaves the Gemini fallback room before
 * the app gives up on that route (lib/networkPolicy.ts).
 */
export const CLAUDE_MODELS = {
  /** Medium effort: complete referral and injection refusals, about 10 s (synthetic test, 2026-10-15). */
  analysis: { model: 'claude-haiku-5-5', effort: 'medium' },
  /**
   * Medium: low repeated the referral twice. First text in about 2 s; the app waits 45 s, the timeout bounds the first text.
   * maxTokens covers thinking and text, keeping a reply far below the 32,000-character history limit (Gemini chat: 2048).
   */
  chat: { model: 'claude-haiku-5-5', effort: 'medium', timeoutMs: 20_000, maxTokens: 4096 },
  /** Title, theme and type only. The app waits 30 s. */
  categorize: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 15_000 },
  /** One short question. The app waits 15 s. */
  recall: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 7_000 },
  /**
   * A faithful rewrite of the whole account. The app waits 20 s. A longer account goes straight to
   * Gemini, as before: its rewrite would take Claude most of that time and leave none for the fallback.
   */
  formatRecall: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 10_000, maxTranscriptChars: 4_000 },
  /** One letter per account and lunar cycle, about 200 words. The app waits 60 s. */
  moonLetter: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 30_000 },
} as const;

/** Text previews that were retired from the Interactions API (404 on request). */
export const RETIRED_TEXT_PREVIEW_MODELS: ReadonlySet<string> = new Set([
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
]);

/**
 * Retired or deprecated image models; env overrides pointing at them are ignored.
 * `gemini-3.1-flash-image` (deprecated 2026-10-06) was the HD default in `.env.example`,
 * so a secret copied from it must not keep HD on that model.
 */
export const RETIRED_IMAGE_MODELS: ReadonlySet<string> = new Set([
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
]);
