import {
  PRODUCT_ANALYTICS_BATCH_BYTES,
  PRODUCT_ANALYTICS_QUEUE_LIMIT,
  PRODUCT_ANALYTICS_QUEUE_TTL_MS,
  getUtf8ByteLength,
  pruneProductAnalyticsQueue,
  selectProductAnalyticsBatch,
  type ProductAnalyticsEnvelope,
} from '@/lib/productAnalyticsQueue';

function event(index: number, occurredAt = Date.now()): ProductAnalyticsEnvelope {
  return {
    event_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    event_name: 'onboarding_step_viewed',
    schema_version: 1,
    occurred_at: new Date(occurredAt).toISOString(),
    journey_id: '00000000-0000-4000-8000-000000000001',
    platform: 'android',
    app_version: '2.0.2',
    locale: 'fr',
    properties: { step: 'intro' },
  };
}

describe('product analytics queue', () => {
  it('keeps the newest 200 events and removes entries older than seven days', () => {
    const now = Date.now();
    const events = [
      event(999, now - PRODUCT_ANALYTICS_QUEUE_TTL_MS - 1),
      ...Array.from({ length: PRODUCT_ANALYTICS_QUEUE_LIMIT + 5 }, (_, index) => event(index, now)),
    ];

    const result = pruneProductAnalyticsQueue(events, now);

    expect(result).toHaveLength(PRODUCT_ANALYTICS_QUEUE_LIMIT);
    expect(result[0].event_id).toBe(event(5, now).event_id);
    expect(result.some((item) => item.event_id === event(999, now).event_id)).toBe(false);
  });

  it('batches at most 20 events and never exceeds 32 KiB', () => {
    const result = selectProductAnalyticsBatch(
      Array.from({ length: 30 }, (_, index) => event(index))
    );

    expect(result).toHaveLength(20);
    expect(getUtf8ByteLength(JSON.stringify({ events: result }))).toBeLessThanOrEqual(
      PRODUCT_ANALYTICS_BATCH_BYTES
    );
  });

  it('stops before an event would exceed the byte budget', () => {
    const first = event(1);
    const oversized = {
      ...event(2),
      properties: { payload: 'é'.repeat(PRODUCT_ANALYTICS_BATCH_BYTES) },
    };

    expect(selectProductAnalyticsBatch([first, oversized])).toEqual([first]);
  });
});
