import { jsonResponse } from './http.ts';

/**
 * Plus is sold as unlimited, subject to abuse prevention: at most this many new
 * analyses and illustrations per rolling 24 hours. The analysis ceiling is
 * enforced in SQL by reserve_authenticated_analysis_authorization
 * (20261021153000_cap_plus_daily_analyses); a static test keeps both equal.
 */
export const PLUS_DAILY_LIMITS = { analysis: 10, image: 10 } as const;

export const PLUS_DAILY_WINDOW_SECONDS = 24 * 60 * 60;

export type PlusDailyLimitCode = 'DAILY_ANALYSIS_LIMIT' | 'DAILY_IMAGE_LIMIT';

/** A calm 429: the dream stays saved, the client says when to come back and never retries on its own. */
export const plusDailyLimitResponse = (denial: {
  code: PlusDailyLimitCode;
  dailyLimit: number;
  retryAfterSeconds?: number | null;
}): Response => {
  const retryAfter = typeof denial.retryAfterSeconds === 'number' && Number.isFinite(denial.retryAfterSeconds)
    ? Math.min(PLUS_DAILY_WINDOW_SECONDS, Math.max(1, Math.ceil(denial.retryAfterSeconds)))
    : PLUS_DAILY_WINDOW_SECONDS;
  return jsonResponse(
    {
      error: 'Daily fair use limit reached',
      code: denial.code,
      dailyLimit: denial.dailyLimit,
      retryAfter,
    },
    429,
    { 'Retry-After': String(retryAfter) }
  );
};
