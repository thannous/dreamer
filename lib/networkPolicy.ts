import type { HttpOptions } from './http';

export type NetworkRequestPolicy = Required<Pick<HttpOptions, 'timeoutMs' | 'retries' | 'retryDelay'>>;

const createPolicy = (timeoutMs: number, retries: number, retryDelay: number): NetworkRequestPolicy => ({
  timeoutMs,
  retries,
  retryDelay,
});

/**
 * Centralized timeout/retry policy for backend HTTP endpoints.
 * Keep this file as the single source of truth for request behavior.
 */
export const NETWORK_REQUEST_POLICIES = {
  default: createPolicy(30000, 0, 2000),

  // Auth / session
  guestSessionCreate: createPolicy(10000, 1, 750),
  authMarkUpgrade: createPolicy(10000, 2, 1000),

  // Quota / subscription
  quotaStatus: createPolicy(10000, 1, 750),
  subscriptionSync: createPolicy(10000, 1, 1000),

  // Analysis + chat
  analyzeDream: createPolicy(45000, 1, 1200),
  categorizeDream: createPolicy(30000, 1, 1200),
  analyzeDreamFull: createPolicy(60000, 1, 1200),
  chat: createPolicy(45000, 0, 1200), // no auto-retry to avoid duplicate sends

  // Media generation
  generateImage: createPolicy(60000, 2, 1200),
  generateImageWithReference: createPolicy(90000, 1, 1500),
  textToSpeech: createPolicy(60000, 1, 1200),
  transcribeAudio: createPolicy(60000, 1, 1200),
} as const;

