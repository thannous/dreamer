import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { getLocales } from 'expo-localization';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import type { AnalyticsEventMap, AnalyticsEventName, AnalyticsProvider } from '@/lib/analytics';
import { getApiBaseUrl } from '@/lib/config';
import { createScopedLogger } from '@/lib/logger';
import {
  fetchProductAnalyticsJSON,
  resetProductAnalyticsGuestSessionForTesting,
} from '@/lib/productAnalyticsGuestSession';
import {
  PRODUCT_ANALYTICS_QUEUE_TTL_MS,
  pruneProductAnalyticsQueue,
  selectProductAnalyticsBatch,
  type ProductAnalyticsEnvelope,
  type ProductAnalyticsPrimitive,
} from '@/lib/productAnalyticsQueue';

const log = createScopedLogger('[ProductAnalytics]');

const QUEUE_KEY = 'product-analytics-queue-v1';
const PREFERENCE_KEY = 'product-analytics-preference-v1';
const JOURNEY_KEY = 'product-analytics-journey-v1';
const ONCE_KEY = 'product-analytics-once-v1';
const PENDING_DELETION_KEY = 'product-analytics-pending-deletion-v1';
const PRODUCT_ANALYTICS_DELETION_TTL_MS = PRODUCT_ANALYTICS_QUEUE_TTL_MS;
const PRODUCT_ANALYTICS_DELETION_BATCH_SIZE = 20;
const PRODUCT_ANALYTICS_PENDING_DELETION_LIMIT = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ANALYTICS_EVENT_NAMES = new Set<AnalyticsEventName>([
  'app_session_started',
  'onboarding_started',
  'onboarding_step_viewed',
  'onboarding_completed',
  'onboarding_destination_viewed',
  'dream_capture_started',
  'recording_started',
  'recording_saved',
  'recording_activation_insight_shown',
  'analysis_started',
  'analysis_completed',
  'analysis_offer_viewed',
  'first_dream_next_action_selected',
  'analysis_failed',
  'analysis_result_viewed',
  'symbol_detail_viewed',
  'first_value_viewed',
  'paywall_viewed',
  'empty_journal_remembered_cta_clicked',
  'onboarding_choice_selected',
]);

const FORBIDDEN_PROPERTY_KEYS = new Set([
  'transcript',
  'title',
  'interpretation',
  'prompt',
  'dream_id',
  'user_id',
  'email',
  'fingerprint',
  'ip',
  'url',
]);

type PropertyValueValidator = (value: unknown) => boolean;
type PropertySchema = Record<string, PropertyValueValidator>;

const oneOf = <T extends ProductAnalyticsPrimitive>(...values: T[]): PropertyValueValidator =>
  (value) => values.includes(value as T);
const bool: PropertyValueValidator = (value) => typeof value === 'boolean';
const nullableCount: PropertyValueValidator = (value) =>
  value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000);
const nullableIdentifier: PropertyValueValidator = (value) =>
  value === null || (typeof value === 'string' && value.length <= 96 && /^[a-zA-Z0-9._:-]*$/.test(value));
const supportedLanguage = oneOf('fr', 'en', 'es', 'de', 'it');
const subscriptionTier = oneOf('guest', 'free', 'plus');

const PRODUCT_ANALYTICS_PROPERTY_SCHEMAS: Record<AnalyticsEventName, PropertySchema> = {
  app_session_started: { source: oneOf('cold_start', 'foreground') },
  onboarding_started: { experience_version: oneOf(2) },
  onboarding_step_viewed: { step: oneOf('intro', 'path') },
  onboarding_completed: {
    reason: oneOf('analyze', 'memory', 'dictionary', 'skip'),
    experience_version: oneOf(2),
  },
  onboarding_destination_viewed: {
    destination: oneOf('recording', 'symbol_dictionary'),
    path: oneOf('analyze', 'memory', 'dictionary', 'skip'),
  },
  dream_capture_started: {
    input_mode: oneOf('voice', 'text'),
    capture_context: oneOf('fresh', 'remembered'),
  },
  recording_started: {
    input_mode: oneOf('voice', 'text'),
    language: supportedLanguage,
    speech_available: bool,
    offline_model_state: oneOf('ready', 'online_fallback', 'unavailable', 'unknown'),
  },
  recording_saved: {
    input_mode: oneOf('voice', 'text'),
    capture_context: oneOf('fresh', 'remembered'),
    duration_bucket: oneOf('0_15s', '16_60s', '61_180s', '181s_plus', 'unknown'),
    transcript_length_bucket: oneOf('0_100', '101_500', '501_1500', '1501_plus'),
  },
  recording_activation_insight_shown: {
    surface: oneOf('draft', 'first_dream_sheet', 'analyze_prompt_sheet'),
    capture_context: oneOf('fresh', 'remembered'),
    transcript_length_bucket: oneOf('0_100', '101_500', '501_1500', '1501_plus'),
    language: supportedLanguage,
  },
  analysis_started: {
    source: oneOf('recording_flow', 'journal_detail', 'retry', 'unknown'),
    tier: subscriptionTier,
    guest_status: oneOf('guest', 'signed_in'),
  },
  analysis_completed: {
    duration_ms_bucket: oneOf('0_5s', '5_15s', '15_45s', '45s_plus'),
    generated_image: bool,
    tier: subscriptionTier,
  },
  analysis_offer_viewed: { quota_state: oneOf('known', 'unlimited', 'exhausted', 'unknown') },
  first_dream_next_action_selected: {
    action: oneOf('launch_analysis', 'view_dream', 'later', 'analyze_memory'),
  },
  analysis_failed: {
    stage: oneOf('offer', 'request', 'result'),
    reason: oneOf('network', 'quota', 'auth', 'server', 'unknown'),
  },
  analysis_result_viewed: {
    source: oneOf('recording_flow', 'journal_detail', 'retry', 'unknown'),
  },
  symbol_detail_viewed: { source: oneOf('onboarding', 'dictionary', 'search', 'guide', 'unknown') },
  first_value_viewed: {
    value: oneOf('analysis_result', 'recording_insight', 'symbol_detail'),
    onboarding_path: oneOf('analyze', 'memory', 'dictionary', 'skip', 'unknown'),
    hours_since_onboarding_bucket: oneOf('0_1h', '1_24h', '24h_plus', 'unknown'),
  },
  paywall_viewed: {
    trigger: oneOf(
      'analysis_limit',
      'analysis_cta',
      'exploration_limit',
      'image_generation',
      'settings',
      'settings_quota',
      'restore',
      'returning_device',
      'direct'
    ),
    tier: subscriptionTier,
    usage_count: nullableCount,
    offering_id: nullableIdentifier,
  },
  empty_journal_remembered_cta_clicked: { source: oneOf('journal_empty_state') },
  onboarding_choice_selected: {
    surface: oneOf('app_onboarding'),
    step: oneOf('intro', 'path'),
    choice: oneOf('continue', 'skip', 'analyze', 'memory', 'dictionary'),
  },
};

type ProductAnalyticsPreference = 'enabled' | 'disabled';
type JourneyRecord = { id: string; createdAt: number; expiresAt: number };
type OnceRecord = { journeyId: string; expiresAt: number; eventNames: string[] };
type PendingDeletion = { journeyId: string; expiresAt: number };

type IngestResponse = {
  accepted_event_ids?: string[];
  rejected_event_ids?: string[];
};

let preferenceCache: ProductAnalyticsPreference | null = null;
let journeyPromise: Promise<JourneyRecord | null> | null = null;
let storageChain: Promise<unknown> = Promise.resolve();
let flushPromise: Promise<void> | null = null;
let deletionFlushPromise: Promise<void> | null = null;
let transportChain: Promise<unknown> = Promise.resolve();
let initialized = false;
let remoteDisabled = false;
let effectiveLocale: ProductAnalyticsEnvelope['locale'] | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let networkSubscription: { remove: () => void } | null = null;

function runSerialized<T>(work: () => Promise<T>): Promise<T> {
  const run = storageChain.then(work, work);
  storageChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function runTransport<T>(work: () => Promise<T>): Promise<T> {
  const run = transportChain.then(work, work);
  transportChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isEnvelope(value: unknown): value is ProductAnalyticsEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'event_id',
    'event_name',
    'schema_version',
    'occurred_at',
    'journey_id',
    'platform',
    'app_version',
    'locale',
    'properties',
  ].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return false;
  }
  const candidate = value as Partial<ProductAnalyticsEnvelope>;
  const normalizedProperties = candidate.properties && typeof candidate.properties === 'object'
    ? normalizeProperties(candidate.properties as Record<string, unknown>)
    : null;
  return (
    typeof candidate.event_id === 'string' &&
    UUID_PATTERN.test(candidate.event_id) &&
    typeof candidate.event_name === 'string' &&
    PRODUCT_ANALYTICS_EVENT_NAMES.has(candidate.event_name as AnalyticsEventName) &&
    candidate.schema_version === 1 &&
    typeof candidate.occurred_at === 'string' &&
    (candidate.journey_id === null ||
      (typeof candidate.journey_id === 'string' && UUID_PATTERN.test(candidate.journey_id))) &&
    candidate.platform === 'android' &&
    typeof candidate.app_version === 'string' &&
    /^[0-9A-Za-z.+_-]{1,32}$/.test(candidate.app_version) &&
    (candidate.locale === 'fr' ||
      candidate.locale === 'en' ||
      candidate.locale === 'es' ||
      candidate.locale === 'de' ||
      candidate.locale === 'it') &&
    !!normalizedProperties &&
    validateEventProperties(candidate.event_name as AnalyticsEventName, normalizedProperties)
  );
}

async function loadQueue(): Promise<ProductAnalyticsEnvelope[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
  const source = parsed;
  const cleaned = pruneProductAnalyticsQueue(source.filter(isEnvelope));
  if (cleaned.length !== source.length) {
    if (cleaned.length === 0) await AsyncStorage.removeItem(QUEUE_KEY);
    else await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}

async function saveQueue(events: ProductAnalyticsEnvelope[]): Promise<void> {
  const pruned = pruneProductAnalyticsQueue(events);
  if (pruned.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pruned));
}

function normalizeProperties(properties: Record<string, unknown>): Record<string, ProductAnalyticsPrimitive> | null {
  const entries = Object.entries(properties);
  if (entries.length > 16) return null;

  const normalized: Record<string, ProductAnalyticsPrimitive> = {};
  for (const [key, value] of entries) {
    if (
      !/^[a-z][a-z0-9_]{0,47}$/.test(key) ||
      FORBIDDEN_PROPERTY_KEYS.has(key) ||
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && value !== null) ||
      (typeof value === 'string' && value.length > 96) ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      return null;
    }
    normalized[key] = value;
  }
  return normalized;
}

function validateEventProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, ProductAnalyticsPrimitive>
): boolean {
  const schema = PRODUCT_ANALYTICS_PROPERTY_SCHEMAS[eventName];
  const actualKeys = Object.keys(properties).sort();
  const expectedKeys = Object.keys(schema).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    Object.entries(schema).every(([key, validator]) => validator(properties[key]))
  );
}

function getLocale(): ProductAnalyticsEnvelope['locale'] {
  if (effectiveLocale) return effectiveLocale;
  const language = getLocales()[0]?.languageCode?.toLowerCase();
  return language === 'fr' || language === 'es' || language === 'de' || language === 'it'
    ? language
    : 'en';
}

export function setProductAnalyticsLocale(locale: ProductAnalyticsEnvelope['locale']): void {
  effectiveLocale = locale;
}

function getAppVersion(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';
  return String(version).slice(0, 32);
}

function readJourneyRecord(raw: string | null, now: number): JourneyRecord | null {
  const parsed = parseJson<Partial<JourneyRecord> | null>(raw, null);
  if (
    !parsed ||
    typeof parsed.id !== 'string' ||
    typeof parsed.createdAt !== 'number' ||
    typeof parsed.expiresAt !== 'number' ||
    parsed.expiresAt <= now
  ) {
    return null;
  }
  return parsed as JourneyRecord;
}

async function getJourneyRecord(): Promise<JourneyRecord | null> {
  if (!isProductAnalyticsAvailable() || (await getProductAnalyticsPreference()) === 'disabled') {
    return null;
  }
  if (journeyPromise) return journeyPromise;

  journeyPromise = runSerialized(async () => {
    const now = Date.now();
    const existing = readJourneyRecord(await AsyncStorage.getItem(JOURNEY_KEY), now);
    if (existing) return existing;

    const next: JourneyRecord = {
      id: Crypto.randomUUID(),
      createdAt: now,
      expiresAt: now + PRODUCT_ANALYTICS_QUEUE_TTL_MS,
    };
    await AsyncStorage.setItem(JOURNEY_KEY, JSON.stringify(next));
    return next;
  });

  try {
    return await journeyPromise;
  } finally {
    journeyPromise = null;
  }
}

export function isProductAnalyticsAvailable(): boolean {
  return (
    !remoteDisabled &&
    Platform.OS === 'android' &&
    (process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED ?? '').toLowerCase() === 'true'
  );
}

export async function getProductAnalyticsPreference(): Promise<ProductAnalyticsPreference> {
  if (preferenceCache) return preferenceCache;
  try {
    const stored = await AsyncStorage.getItem(PREFERENCE_KEY);
    preferenceCache = stored === null || stored === 'enabled'
      ? 'enabled'
      : 'disabled';
  } catch {
    // A storage failure is not equivalent to the user having no preference.
    // Fail closed for this session instead of starting collection unexpectedly.
    preferenceCache = 'disabled';
  }
  return preferenceCache;
}

export async function getProductAnalyticsJourneyId(): Promise<string | null> {
  return (await getJourneyRecord())?.id ?? null;
}

async function enqueueProductAnalyticsEvent<TName extends AnalyticsEventName>(
  eventName: TName,
  properties: AnalyticsEventMap[TName]
): Promise<void> {
  if (!isProductAnalyticsAvailable() || (await getProductAnalyticsPreference()) === 'disabled') return;

  const normalizedProperties = normalizeProperties(properties as Record<string, unknown>);
  if (!normalizedProperties || !validateEventProperties(eventName, normalizedProperties)) {
    log.warn('event rejected by client privacy guard', eventName);
    return;
  }

  const journey = await getJourneyRecord();
  if (!journey) return;

  const envelope: ProductAnalyticsEnvelope = {
    event_id: Crypto.randomUUID(),
    event_name: eventName,
    schema_version: 1,
    occurred_at: new Date().toISOString(),
    journey_id: journey.id,
    platform: 'android',
    app_version: getAppVersion(),
    locale: getLocale(),
    properties: normalizedProperties,
  };

  const queued = await runSerialized(async () => {
    // The preference cache is flipped synchronously when the user opts out.
    // Recheck inside the serialized write to close the race with an in-flight track call.
    if (preferenceCache === 'disabled') return false;
    const [queue, onceRaw] = await Promise.all([
      loadQueue(),
      AsyncStorage.getItem(ONCE_KEY),
    ]);
    const once = parseJson<OnceRecord | null>(onceRaw, null);
    const onceEventNames =
      once?.journeyId === journey.id && once.expiresAt > Date.now() ? once.eventNames : [];

    if (eventName === 'first_value_viewed' && onceEventNames.includes(eventName)) {
      return false;
    }

    const writes: [string, string][] = [[QUEUE_KEY, JSON.stringify(pruneProductAnalyticsQueue([...queue, envelope]))]];
    if (eventName === 'first_value_viewed') {
      writes.push([
        ONCE_KEY,
        JSON.stringify({
          journeyId: journey.id,
          expiresAt: journey.expiresAt,
          eventNames: [...onceEventNames, eventName],
        } satisfies OnceRecord),
      ]);
    }
    await AsyncStorage.multiSet(writes);
    return true;
  });

  if (queued) void flushProductAnalytics();
}

export function createProductAnalyticsProvider(): AnalyticsProvider {
  return {
    track: enqueueProductAnalyticsEvent,
  };
}

async function isNetworkReachable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

async function sendAnalyticsBatch(events: ProductAnalyticsEnvelope[]): Promise<IngestResponse> {
  return fetchProductAnalyticsJSON<IngestResponse>(`${getApiBaseUrl()}/analytics/events`, {
    method: 'POST',
    body: { events },
    timeoutMs: 10_000,
  });
}

function isRemoteIngestDisabledError(error: unknown): boolean {
  const body = (error as { body?: unknown })?.body;
  if (!body || typeof body !== 'object') return false;
  const errorBody = (body as { error?: unknown }).error;
  return (
    !!errorBody &&
    typeof errorBody === 'object' &&
    (errorBody as { code?: unknown }).code === 'ANALYTICS_INGEST_DISABLED'
  );
}

async function disableRemoteIngestForSession(): Promise<void> {
  remoteDisabled = true;
  journeyPromise = null;
  await runSerialized(() =>
    AsyncStorage.multiRemove([QUEUE_KEY, JOURNEY_KEY, ONCE_KEY])
  );
}

export async function flushProductAnalytics(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (!isProductAnalyticsAvailable() || (await getProductAnalyticsPreference()) === 'disabled') return;
    if (!(await isNetworkReachable())) return;

    for (let iteration = 0; iteration < 10; iteration += 1) {
      const batch = await runSerialized(async () => selectProductAnalyticsBatch(await loadQueue()));
      if (batch.length === 0) return;
      if (preferenceCache === 'disabled') return;

      let response: IngestResponse | null;
      try {
        response = await runTransport(async () => {
          // A queued POST that has not started is cancelled by an opt-out or
          // the server kill switch. An already-running POST completes before
          // the serialized privacy DELETE is allowed to start.
          if (preferenceCache === 'disabled' || remoteDisabled) return null;
          return sendAnalyticsBatch(batch);
        });
      } catch (error) {
        if (isRemoteIngestDisabledError(error)) {
          await disableRemoteIngestForSession();
          return;
        }
        log.warn('flush failed', error);
        return;
      }
      if (!response) return;

      const handledIds = new Set([
        ...(response.accepted_event_ids ?? []),
        ...(response.rejected_event_ids ?? []),
      ]);
      if (handledIds.size === 0) return;

      await runSerialized(async () => {
        const current = await loadQueue();
        await saveQueue(current.filter((event) => !handledIds.has(event.event_id)));
      });
    }
  })();

  try {
    await flushPromise;
  } finally {
    flushPromise = null;
  }
}

function readPendingDeletions(raw: string | null, now = Date.now()): PendingDeletion[] {
  const parsed = parseJson<unknown>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const latestAllowedExpiry = now + PRODUCT_ANALYTICS_DELETION_TTL_MS;
  return parsed.flatMap((item): PendingDeletion[] => {
    if (
      !!item &&
      typeof item === 'object' &&
      typeof (item as PendingDeletion).journeyId === 'string' &&
      typeof (item as PendingDeletion).expiresAt === 'number' &&
      (item as PendingDeletion).expiresAt > now &&
      (item as PendingDeletion).expiresAt <= latestAllowedExpiry
    ) {
      return [{
        journeyId: (item as PendingDeletion).journeyId,
        expiresAt: (item as PendingDeletion).expiresAt,
      }];
    }
    return [];
  });
}

async function loadPendingDeletions(): Promise<PendingDeletion[]> {
  const raw = await AsyncStorage.getItem(PENDING_DELETION_KEY);
  const valid = readPendingDeletions(raw);
  if (valid.length === 0) {
    if (raw) await AsyncStorage.removeItem(PENDING_DELETION_KEY);
    return [];
  }

  const normalized = JSON.stringify(valid);
  if (normalized !== raw) {
    await AsyncStorage.setItem(PENDING_DELETION_KEY, normalized);
  }
  return valid;
}

async function flushPendingProductAnalyticsDeletions(): Promise<void> {
  if (Platform.OS !== 'android' || deletionFlushPromise) return deletionFlushPromise ?? undefined;
  deletionFlushPromise = (async () => {
    const initialPending = await runSerialized(loadPendingDeletions);
    if (initialPending.length === 0) return;
    if (!(await isNetworkReachable())) return;

    for (let iteration = 0; iteration < 50; iteration += 1) {
      const pending = await runSerialized(loadPendingDeletions);
      if (pending.length === 0) return;
      const batch = pending.slice(0, PRODUCT_ANALYTICS_DELETION_BATCH_SIZE);
      const batchIds = new Set(batch.map((item) => item.journeyId));

      try {
        await runTransport(() =>
          fetchProductAnalyticsJSON(`${getApiBaseUrl()}/analytics/events`, {
            method: 'DELETE',
            body: { journey_ids: [...batchIds] },
            timeoutMs: 10_000,
          })
        );
      } catch (error) {
        log.warn('deletion flush failed', error);
        return;
      }

      await runSerialized(async () => {
        const current = await loadPendingDeletions();
        const remaining = current.filter((item) => !batchIds.has(item.journeyId));
        if (remaining.length === 0) await AsyncStorage.removeItem(PENDING_DELETION_KEY);
        else await AsyncStorage.setItem(PENDING_DELETION_KEY, JSON.stringify(remaining));
      });
    }
  })();
  try {
    await deletionFlushPromise;
  } finally {
    deletionFlushPromise = null;
  }
}

export async function setProductAnalyticsEnabled(enabled: boolean): Promise<void> {
  const previousPreference = preferenceCache;
  preferenceCache = enabled ? 'enabled' : 'disabled';
  let preferenceWriteError: unknown = null;
  try {
    await AsyncStorage.setItem(PREFERENCE_KEY, preferenceCache);
  } catch (error) {
    preferenceWriteError = error;
    if (enabled) {
      preferenceCache = previousPreference ?? 'disabled';
      throw error;
    }
  }

  if (enabled) {
    await initializeProductAnalytics();
    await flushProductAnalytics();
    return;
  }

  await runSerialized(async () => {
    const [queue, journeyRaw, pendingRaw] = await Promise.all([
      loadQueue(),
      AsyncStorage.getItem(JOURNEY_KEY),
      AsyncStorage.getItem(PENDING_DELETION_KEY),
    ]);
    const journey = readJourneyRecord(journeyRaw, Date.now());
    const pending = readPendingDeletions(pendingRaw);
    const merged = new Map(pending.map((item) => [item.journeyId, item]));
    const latestAllowedExpiry = Date.now() + PRODUCT_ANALYTICS_DELETION_TTL_MS;
    const rememberJourneyUntil = (journeyId: string, expiresAt: number) => {
      const boundedExpiry = Math.min(expiresAt, latestAllowedExpiry);
      if (boundedExpiry <= Date.now()) return;
      const existing = merged.get(journeyId);
      merged.set(journeyId, {
        journeyId,
        expiresAt: existing ? Math.min(existing.expiresAt, boundedExpiry) : boundedExpiry,
      });
    };

    queue.forEach((event) => {
      if (!event.journey_id) return;
      const occurredAt = Date.parse(event.occurred_at);
      rememberJourneyUntil(
        event.journey_id,
        Number.isFinite(occurredAt)
          ? occurredAt + PRODUCT_ANALYTICS_DELETION_TTL_MS
          : Date.now()
      );
    });
    if (journey) rememberJourneyUntil(journey.id, journey.expiresAt);

    if (merged.size > PRODUCT_ANALYTICS_PENDING_DELETION_LIMIT) {
      throw new Error('Product analytics pending deletion capacity exceeded');
    }

    const writes: [string, string][] = [];
    if (merged.size > 0) {
      writes.push([PENDING_DELETION_KEY, JSON.stringify([...merged.values()])]);
    }
    if (writes.length > 0) await AsyncStorage.multiSet(writes);
    await AsyncStorage.multiRemove([QUEUE_KEY, JOURNEY_KEY, ONCE_KEY]);
  });
  journeyPromise = null;
  await flushPendingProductAnalyticsDeletions();
  if (preferenceWriteError) throw preferenceWriteError;
}

export async function initializeProductAnalytics(): Promise<void> {
  if (initialized) {
    await flushPendingProductAnalyticsDeletions();
    return;
  }
  initialized = true;

  if (Platform.OS === 'android') {
    networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected !== false && state.isInternetReachable !== false) {
        void flushPendingProductAnalyticsDeletions();
        void flushProductAnalytics();
      }
    });
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void flushPendingProductAnalyticsDeletions();
        void flushProductAnalytics();
      }
    });
  }

  await flushPendingProductAnalyticsDeletions();
  await flushProductAnalytics();
}

export async function resetProductAnalyticsForTesting(): Promise<void> {
  appStateSubscription?.remove();
  networkSubscription?.remove();
  appStateSubscription = null;
  networkSubscription = null;
  initialized = false;
  preferenceCache = null;
  journeyPromise = null;
  flushPromise = null;
  deletionFlushPromise = null;
  transportChain = Promise.resolve();
  storageChain = Promise.resolve();
  remoteDisabled = false;
  effectiveLocale = null;
  await resetProductAnalyticsGuestSessionForTesting();
}
