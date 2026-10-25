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
