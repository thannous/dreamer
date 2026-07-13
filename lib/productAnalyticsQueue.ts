export type ProductAnalyticsPrimitive = string | number | boolean | null;

export type ProductAnalyticsEnvelope = {
  event_id: string;
  event_name: string;
  schema_version: 1;
  occurred_at: string;
  journey_id: string | null;
  platform: 'android' | 'ios' | 'web';
  app_version: string;
  locale: 'fr' | 'en' | 'es' | 'de' | 'it';
  properties: Record<string, ProductAnalyticsPrimitive>;
};

export const PRODUCT_ANALYTICS_QUEUE_LIMIT = 200;
export const PRODUCT_ANALYTICS_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PRODUCT_ANALYTICS_BATCH_LIMIT = 20;
export const PRODUCT_ANALYTICS_BATCH_BYTES = 32 * 1024;

export function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).byteLength;
  }

  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function pruneProductAnalyticsQueue(
  events: ProductAnalyticsEnvelope[],
  now = Date.now()
): ProductAnalyticsEnvelope[] {
  const oldestAllowed = now - PRODUCT_ANALYTICS_QUEUE_TTL_MS;
  return events
    .filter((event) => {
      const occurredAt = Date.parse(event.occurred_at);
      return Number.isFinite(occurredAt) && occurredAt >= oldestAllowed && occurredAt <= now + 60_000;
    })
    .slice(-PRODUCT_ANALYTICS_QUEUE_LIMIT);
}

export function selectProductAnalyticsBatch(
  events: ProductAnalyticsEnvelope[]
): ProductAnalyticsEnvelope[] {
  const batch: ProductAnalyticsEnvelope[] = [];

  for (const event of events) {
    if (batch.length >= PRODUCT_ANALYTICS_BATCH_LIMIT) break;
    const candidate = [...batch, event];
    if (getUtf8ByteLength(JSON.stringify({ events: candidate })) > PRODUCT_ANALYTICS_BATCH_BYTES) {
      break;
    }
    batch.push(event);
  }

  return batch;
}
