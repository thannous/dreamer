export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const GUEST_LIMITS = { analysis: 2, exploration: 2, messagesPerDream: 10 } as const;

export const RECONCILE_MAX_DURATION_MS = 25000;
export const RECONCILE_DEFAULT_BATCH = 150;
export const RECONCILE_MAX_BATCH = 300;
export const RECONCILE_DEFAULT_MAX_TOTAL = 1000;
export const RECONCILE_DEFAULT_MIN_AGE_HOURS = 24;
