/** Service failures only. Keep the SQL predicate in the refund migration in sync. */
export const REFUNDABLE_TEXT_ANALYSIS_FAILURE_CODES = [
  'ANALYSIS_PROVIDER_UNAVAILABLE',
  'ANALYSIS_PROVIDER_OVERLOADED',
  'ANALYSIS_PROVIDER_REFUSED',
  'ANALYSIS_TIMEOUT',
  'ANALYSIS_SERVER_ERROR',
  'ANALYSIS_CONFIGURATION_ERROR',
  'ANALYSIS_INVALID_OUTPUT',
  'AI_JOB_LEASE_EXPIRED',
] as const;

export type TextAnalysisRefundCode = typeof REFUNDABLE_TEXT_ANALYSIS_FAILURE_CODES[number];

export const isRefundableTextAnalysisFailure = (code: unknown): code is TextAnalysisRefundCode =>
  typeof code === 'string'
  && (REFUNDABLE_TEXT_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code);

/** Explicit user/state failures are terminal; all other worker errors may be retried. */
export const TERMINAL_TEXT_ANALYSIS_FAILURE_CODES = [
  'ANALYSIS_TRANSCRIPT_CHANGED', 'ANALYSIS_TRANSCRIPT_MISMATCH',
  'ANALYSIS_STATE_CONFLICT', 'ANALYSIS_REQUEST_STALE', 'DREAM_NOT_FOUND',
  'ANALYSIS_ACCESS_DENIED', 'ANALYSIS_CLIENT_CANCELLED', 'INVALID_TRANSCRIPT', 'ANALYSIS_REQUEST_REJECTED',
  'ANALYSIS_ALREADY_CLAIMED', 'ANALYSIS_IDEMPOTENCY_KEY_REUSED',
] as const;

export const isTerminalTextAnalysisFailure = (code: unknown): boolean =>
  typeof code === 'string'
  && (TERMINAL_TEXT_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code);
