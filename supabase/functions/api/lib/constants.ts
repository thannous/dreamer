export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // DELETE is not a CORS-safelisted method: without this line browsers refuse
  // `DELETE /account` and `DELETE /analytics/events` at the preflight.
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-guest-token, x-guest-fingerprint, x-guest-platform, x-analytics-guest-token',
};

export const GUEST_LIMITS = { analysis: 2, exploration: null, image: 2, messagesPerDream: 10 } as const;

export const RECONCILE_MAX_DURATION_MS = 25000;
export const RECONCILE_DEFAULT_BATCH = 150;
export const RECONCILE_MAX_BATCH = 300;
export const RECONCILE_DEFAULT_MAX_TOTAL = 1000;
export const RECONCILE_DEFAULT_MIN_AGE_HOURS = 24;

/** Longest wait for an answer from another service before the call is given up. */
export const OUTBOUND_REQUEST_TIMEOUT_MS = 10_000;
