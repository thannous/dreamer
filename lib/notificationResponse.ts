const DEFAULT_TRACKED_RESPONSE_LIMIT = 16;

export type NotificationResponseTracker = {
  claim: (identifier: string | null | undefined) => boolean;
  release: (identifier: string | null | undefined) => void;
};

/**
 * Expo can expose the same native response through both the cold-start lookup
 * and the live response listener. Claiming the request synchronously keeps the
 * async persistence path idempotent while retaining a bounded session history.
 */
export function createNotificationResponseTracker(
  limit = DEFAULT_TRACKED_RESPONSE_LIMIT
): NotificationResponseTracker {
  const handledIdentifiers = new Set<string>();
  const boundedLimit = Math.max(1, Math.floor(limit));

  return {
    claim(identifier) {
      if (!identifier) return true;
      if (handledIdentifiers.has(identifier)) return false;

      handledIdentifiers.add(identifier);
      while (handledIdentifiers.size > boundedLimit) {
        const oldestIdentifier = handledIdentifiers.values().next().value;
        if (!oldestIdentifier) break;
        handledIdentifiers.delete(oldestIdentifier);
      }
      return true;
    },
    release(identifier) {
      if (identifier) handledIdentifiers.delete(identifier);
    },
  };
}
