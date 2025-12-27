import type {
  RevenueCatV2CustomerResponse,
  Tier as RevenueCatTier,
} from '../../../lib/revenuecatSubscriber.ts';

const SUBSCRIPTION_SYNC_TIMEOUT_MS = 8000;
const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000;

type RevenueCatEntitlement = {
  id?: string | null;
  lookup_key?: string | null;
  display_name?: string | null;
};

type RevenueCatEntitlementsResponse = {
  items?: RevenueCatEntitlement[] | null;
  next_page?: string | null;
};

type RevenueCatEntitlementCache = {
  map: Record<string, string>;
  fetchedAt: number;
};

let entitlementCache: RevenueCatEntitlementCache | null = null;
let entitlementCachePromise: Promise<Record<string, string>> | null = null;

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

function normalizeEntitlementField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function fetchRevenueCatEntitlementsPage(
  url: string,
  apiKey: string,
  timeoutMs: number
): Promise<RevenueCatEntitlementsResponse> {
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

    return (await res.json()) as RevenueCatEntitlementsResponse;
  } finally {
    clearTimeout(timeout);
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

export function getRevenueCatProjectId(): string {
  const projectId = getOptionalEnv('REVENUECAT_PROJECT_ID');
  if (!projectId) {
    throw new Error('Missing REVENUECAT_PROJECT_ID');
  }
  return projectId;
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

export async function fetchRevenueCatCustomer(
  appUserId: string,
  apiKey: string,
  projectId: string,
  timeoutMs: number = SUBSCRIPTION_SYNC_TIMEOUT_MS
): Promise<RevenueCatV2CustomerResponse> {
  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(appUserId)}`;
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

    return (await res.json()) as RevenueCatV2CustomerResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRevenueCatEntitlementLookup(
  apiKey: string,
  projectId: string,
  timeoutMs: number = SUBSCRIPTION_SYNC_TIMEOUT_MS
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/entitlements`;
  let pageCount = 0;

  while (url && pageCount < 10) {
    const data = await fetchRevenueCatEntitlementsPage(url, apiKey, timeoutMs);
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      const id = normalizeEntitlementField(item.id);
      const lookup =
        normalizeEntitlementField(item.lookup_key) ?? normalizeEntitlementField(item.display_name);
      if (id && lookup) {
        map[id] = lookup;
      }
    }

    pageCount += 1;
    const nextPage = normalizeEntitlementField(data.next_page);
    if (!nextPage) break;
    url = nextPage.startsWith('http') ? nextPage : `https://api.revenuecat.com${nextPage}`;
  }

  return map;
}

export async function getRevenueCatEntitlementLookup(
  apiKey: string,
  projectId: string,
  timeoutMs: number = SUBSCRIPTION_SYNC_TIMEOUT_MS
): Promise<Record<string, string>> {
  const now = Date.now();
  if (entitlementCache && now - entitlementCache.fetchedAt < ENTITLEMENT_CACHE_TTL_MS) {
    return entitlementCache.map;
  }

  if (entitlementCachePromise) {
    return entitlementCachePromise;
  }

  entitlementCachePromise = fetchRevenueCatEntitlementLookup(apiKey, projectId, timeoutMs)
    .then((map) => {
      entitlementCache = { map, fetchedAt: Date.now() };
      entitlementCachePromise = null;
      return map;
    })
    .catch((error) => {
      entitlementCachePromise = null;
      throw error;
    });

  return entitlementCachePromise;
}
