import type {
  RevenueCatEntitlementLookupById,
  RevenueCatV2CustomerResponse,
} from '../lib/revenuecatSubscriber.ts';

const SUBSCRIPTION_SYNC_TIMEOUT_MS = 8000;
const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTITLEMENT_PAGES = 10;

type RevenueCatEntitlement = {
  id?: string | null;
  lookup_key?: string | null;
  display_name?: string | null;
};

type RevenueCatEntitlementsResponse = {
  items?: RevenueCatEntitlement[] | null;
  next_page?: string | null;
};

type RevenueCatAliasesResponse = {
  items?: { id?: string | null }[] | null;
};

type RevenueCatEntitlementCache = {
  map: RevenueCatEntitlementLookupById;
  fetchedAt: number;
};

function getOptionalEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) return null;
  return value.trim();
}

export class RevenueCatHttpError extends Error {
  public override readonly name = 'RevenueCatHttpError';
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

function customerUrl(appUserId: string, projectId: string): string {
  return `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`;
}

/** Each function runtime owns its cache; callers retain their subscription decisions. */
export function createRevenueCatClient(dependencies: {
  fetch?: typeof fetch;
  now?: () => number;
} = {}) {
  const fetchRequest: typeof fetch = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const now = dependencies.now ?? (() => Date.now());
  let entitlementCache: RevenueCatEntitlementCache | null = null;
  let entitlementCachePromise: Promise<RevenueCatEntitlementLookupById> | null = null;

  async function requestJson<T>(url: string, apiKey: string, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchRequest(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new RevenueCatHttpError({
          status: response.status,
          statusText: response.statusText,
          url,
          bodyText,
        });
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchRevenueCatCustomer(
    appUserId: string,
    apiKey: string,
    projectId: string,
    timeoutMs = SUBSCRIPTION_SYNC_TIMEOUT_MS,
  ): Promise<RevenueCatV2CustomerResponse> {
    return await requestJson<RevenueCatV2CustomerResponse>(customerUrl(appUserId, projectId), apiKey, timeoutMs);
  }

  async function fetchRevenueCatCustomerAliases(
    appUserId: string,
    apiKey: string,
    projectId: string,
    timeoutMs = SUBSCRIPTION_SYNC_TIMEOUT_MS,
  ): Promise<string[]> {
    const data = await requestJson<RevenueCatAliasesResponse>(
      `${customerUrl(appUserId, projectId)}/aliases`, apiKey, timeoutMs,
    );
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item) => typeof item.id === 'string' ? item.id.trim() : '').filter(Boolean);
  }

  async function fetchEntitlementLookup(
    apiKey: string,
    projectId: string,
    timeoutMs: number,
  ): Promise<RevenueCatEntitlementLookupById> {
    const map: RevenueCatEntitlementLookupById = {};
    let url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/entitlements`;
    let pageCount = 0;
    while (url && pageCount < MAX_ENTITLEMENT_PAGES) {
      const data = await requestJson<RevenueCatEntitlementsResponse>(url, apiKey, timeoutMs);
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        const id = normalizeEntitlementField(item.id);
        const lookup = normalizeEntitlementField(item.lookup_key) ?? normalizeEntitlementField(item.display_name);
        if (id && lookup) map[id] = lookup;
      }
      pageCount += 1;
      const nextPage = normalizeEntitlementField(data.next_page);
      if (!nextPage) break;
      url = nextPage.startsWith('http') ? nextPage : `https://api.revenuecat.com${nextPage}`;
    }
    return map;
  }

  async function getRevenueCatEntitlementLookup(
    apiKey: string,
    projectId: string,
    timeoutMs = SUBSCRIPTION_SYNC_TIMEOUT_MS,
  ): Promise<RevenueCatEntitlementLookupById> {
    if (entitlementCache && now() - entitlementCache.fetchedAt < ENTITLEMENT_CACHE_TTL_MS) {
      return entitlementCache.map;
    }
    if (entitlementCachePromise) return entitlementCachePromise;
    entitlementCachePromise = fetchEntitlementLookup(apiKey, projectId, timeoutMs)
      .then((map) => {
        entitlementCache = { map, fetchedAt: now() };
        return map;
      })
      .finally(() => { entitlementCachePromise = null; });
    return entitlementCachePromise;
  }

  return { fetchRevenueCatCustomer, fetchRevenueCatCustomerAliases, getRevenueCatEntitlementLookup };
}

export const {
  fetchRevenueCatCustomer,
  fetchRevenueCatCustomerAliases,
  getRevenueCatEntitlementLookup,
} = createRevenueCatClient();

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
  if (!projectId) throw new Error('Missing REVENUECAT_PROJECT_ID');
  return projectId;
}

export function getReconcileSecret(): string | null {
  return (
    getOptionalEnv('REVENUECAT_RECONCILE_SECRET') ??
    getOptionalEnv('REVENUECAT_RECONCILE_AUTH') ??
    getOptionalEnv('REVENUECAT_RECONCILE_AUTHORIZATION')
  );
}
