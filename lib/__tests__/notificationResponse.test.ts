import { describe, expect, it } from '@jest/globals';

import { createNotificationResponseTracker } from '@/lib/notificationResponse';

describe('createNotificationResponseTracker', () => {
  it('claims one native response only once per app session', () => {
    const tracker = createNotificationResponseTracker();

    expect(tracker.claim('response-1')).toBe(true);
    expect(tracker.claim('response-1')).toBe(false);
  });

  it('allows a persistence failure to release the response for retry', () => {
    const tracker = createNotificationResponseTracker();

    expect(tracker.claim('response-1')).toBe(true);
    tracker.release('response-1');
    expect(tracker.claim('response-1')).toBe(true);
  });

  it('accepts responses without an identifier instead of dropping them', () => {
    const tracker = createNotificationResponseTracker();

    expect(tracker.claim(undefined)).toBe(true);
    expect(tracker.claim(undefined)).toBe(true);
  });

  it('bounds retained identifiers and evicts the oldest response', () => {
    const tracker = createNotificationResponseTracker(2);

    expect(tracker.claim('response-1')).toBe(true);
    expect(tracker.claim('response-2')).toBe(true);
    expect(tracker.claim('response-3')).toBe(true);
    expect(tracker.claim('response-1')).toBe(true);
    expect(tracker.claim('response-3')).toBe(false);
  });
});
