export type CircuitBreaker = {
  /**
   * Returns true when the circuit should block the next operation.
   * This call does not record a new attempt.
   */
  shouldBlock: (now?: number) => boolean;
  /** Record a new attempt timestamp. */
  record: (now?: number) => void;
  /** Current attempt count within the window. */
  count: (now?: number) => number;
  /** Clear all recorded attempts. */
  reset: () => void;
};

export function createCircuitBreaker(params: { maxAttempts: number; windowMs: number }): CircuitBreaker {
  const { maxAttempts, windowMs } = params;
  let attempts: number[] = [];

  const prune = (now: number) => {
    attempts = attempts.filter((ts) => now - ts < windowMs);
  };

  return {
    shouldBlock(now = Date.now()) {
      prune(now);
      return attempts.length >= maxAttempts;
    },
    record(now = Date.now()) {
      prune(now);
      attempts.push(now);
    },
    count(now = Date.now()) {
      prune(now);
      return attempts.length;
    },
    reset() {
      attempts = [];
    },
  };
}

