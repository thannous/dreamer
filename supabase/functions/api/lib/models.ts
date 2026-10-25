/** Image registry. Text features use Claude exclusively. */
export const GEMINI_MODELS = {
  image: {
    /** Plus-tier HD (2K/4K) illustrations; Lite renders 1K only. Replaces the deprecated gemini-3.1-flash-image. */
    default: 'gemini-nano-banana-2.1',
    /** Free / guest-tier illustrations. */
    lite: 'gemini-3.1-flash-lite-image',
  },
} as const;

/** Claude is required for every text feature; failures never change provider. */
export const CLAUDE_MODELS = {
  /** Medium effort: complete referral and injection refusals, about 10 s (synthetic test, 2026-10-15). */
  analysis: { model: 'claude-haiku-5-5', effort: 'medium', timeoutMs: 35_000 },
  /**
   * Medium: low repeated the referral twice. First text in about 2 s; the app waits 45 s, the server bounds the whole stream to 35 s.
   * maxTokens covers thinking and text, keeping a reply far below the 32,000-character history limit.
   */
  chat: { model: 'claude-haiku-5-5', effort: 'medium', timeoutMs: 35_000, maxTokens: 4096 },
  /** Title, theme and type only. The app waits 30 s. */
  categorize: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 25_000 },
  /** One short question. The app waits 15 s. */
  recall: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 12_000 },
  /** Full accounts up to the route's 20,000-character limit, without truncation. The app waits 55 s. */
  formatRecall: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 45_000 },
  /** One letter per account and lunar cycle, about 200 words. The app waits 60 s. */
  moonLetter: { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 50_000 },
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

/**
 * Per-function-instance Claude availability breaker, shared by JSON/text/streams.
 * Five consecutive availability failures within 30 s open it for 10 s. Exactly
 * one probe is admitted afterwards; success closes it, failure reopens for 10 s.
 * Worker requeues and keyed HTTP retries honor this cooldown within their existing
 * budgets; no keys/content are retained, no shared table, no extra provider attempt.
 * Configuration, refusals and invalid output do not count as unavailability.
 */
export const TEXT_PROVIDER_CIRCUIT = {
  failureThreshold: 5,
  failureWindowMs: 30_000,
  cooldownMs: 10_000,
} as const;
