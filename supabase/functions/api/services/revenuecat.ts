import type {
  RevenueCatV1SubscriberResponse,
  Tier as RevenueCatTier,
} from '../../../lib/revenuecatSubscriber.ts';

const SUBSCRIPTION_SYNC_TIMEOUT_MS = 8000;

function getOptionalEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) return null;
  return value.trim();
}

export class RevenueCatHttpError extends Error {
  public readonly name = 'RevenueCatHttpError';
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly bodyText: string;

  constructor(options: { status: number; statusText: string; url: string; bodyText: string }) {
    super(`RevenueCat API failed: HTTP ${options.status} ${options.statusText}`);
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.bodyText = options.bodyText;
  }
}

export function getRevenueCatApiKey(): string {
  const apiKey =
    getOptionalEnv('REVENUECAT_SECRET_API_KEY') ??
    getOptionalEnv('REVENUECAT_API_KEY') ??
    getOptionalEnv('REVENUECAT_SECRET_KEY');
  if (!apiKey) {
    throw new Error(
      'Missing REVENUECAT_SECRET_API_KEY (or REVENUECAT_API_KEY / REVENUECAT_SECRET_KEY)'
    );
  }
  return apiKey;
}

export function getReconcileSecret(): string | null {
  return (
    getOptionalEnv('REVENUECAT_RECONCILE_SECRET') ??
    getOptionalEnv('REVENUECAT_RECONCILE_AUTH') ??
    getOptionalEnv('REVENUECAT_RECONCILE_AUTHORIZATION')
  );
}

export function normalizeTier(value: unknown): RevenueCatTier {
  if (value === 'plus' || value === 'premium') return 'plus';
  return 'free';
}

export function getTierUpdatedAt(meta: Record<string, unknown> | null | undefined): string | null {
  const raw = meta?.tier_updated_at;
  if (typeof raw === 'string' && raw.trim()) return raw;
  return null;
}

export function buildUpdatedMetadata(
  meta: Record<string, unknown>,
  tier: RevenueCatTier,
  source: string
): Record<string, unknown> {
  const nowMs = Date.now();
  const lastEventTimestampMs =
    typeof meta.last_tier_event_timestamp_ms === 'number'
      ? meta.last_tier_event_timestamp_ms
      : null;
  const nextEventTimestampMs =
    lastEventTimestampMs && lastEventTimestampMs > nowMs
      ? lastEventTimestampMs
      : nowMs;

  return {
    ...meta,
    tier,
    tier_updated_at: new Date().toISOString(),
    tier_source: source,
    last_tier_event_timestamp_ms: nextEventTimestampMs,
  };
}

export async function fetchRevenueCatSubscriber(
  appUserId: string,
  apiKey: string,
  timeoutMs: number = SUBSCRIPTION_SYNC_TIMEOUT_MS
): Promise<RevenueCatV1SubscriberResponse> {
  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new RevenueCatHttpError({
        status: res.status,
        statusText: res.statusText,
        url,
        bodyText,
      });
    }

    return (await res.json()) as RevenueCatV1SubscriberResponse;
  } finally {
    clearTimeout(timeout);
  }
}
