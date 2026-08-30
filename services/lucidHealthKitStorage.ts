import Storage from 'expo-sqlite/kv-store';

import {
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
  isLucidTrainerEncryptedValueError,
} from '@/services/lucidTrainerSecureStorage';
import {
  LUCID_HK_SLEEP_CATEGORY_VALUES,
  LUCID_HK_SLEEP_GRANULARITIES,
  LUCID_HK_SLEEP_ISSUES,
  type LucidHkSleepNormalization,
  normalizeLucidHkSleepCategoryValue,
} from '@/lib/lucid/healthKitSleep';

const STORAGE_NAMESPACE = 'noctalia_lucid_healthkit';
const SNAPSHOT_KEY_VERSION = 'sleep_snapshot_v1';
export const LUCID_HEALTHKIT_SNAPSHOT_VERSION = 1 as const;

type AsyncKeyValueStorage = Pick<typeof Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LucidHealthKitSnapshotStatus = 'imported' | 'disabled' | 'empty';

export type LucidHealthKitSnapshot = {
  version: typeof LUCID_HEALTHKIT_SNAPSHOT_VERSION;
  status: LucidHealthKitSnapshotStatus;
  importedAt: number | null;
  rangeStartMs: number | null;
  rangeEndMs: number | null;
  normalization: LucidHkSleepNormalization | null;
  emptyReason: 'ambiguous_empty' | null;
};

function assertUserScope(userScope: string): void {
  if (!userScope.trim() || userScope.length > 256) {
    throw new Error('Invalid Lucid HealthKit user scope');
  }
}

export function getLucidHealthKitStorageKey(userScope: string): string {
  assertUserScope(userScope);
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(userScope)}:${SNAPSHOT_KEY_VERSION}`;
}

function usesNativeStorage(storage: AsyncKeyValueStorage): boolean {
  return storage === Storage;
}

async function readPlaintext(key: string, storage: AsyncKeyValueStorage): Promise<string | null> {
  const value = await storage.getItem(key);
  if (!value) return null;
  if (!usesNativeStorage(storage)) return value;
  try {
    return await revealLucidTrainerStoredValue(key, value);
  } catch (error) {
    if (isLucidTrainerEncryptedValueError(error)) {
      await storage.removeItem(key).catch(() => undefined);
    }
    throw error;
  }
}

async function writePlaintext(key: string, value: string, storage: AsyncKeyValueStorage): Promise<void> {
  const protectedValue = usesNativeStorage(storage)
    ? await protectLucidTrainerStoredValue(key, value)
    : value;
  await storage.setItem(key, protectedValue);
}

const SNAPSHOT_STATUSES = ['imported', 'disabled', 'empty'] as const;

function emptySnapshot(): LucidHealthKitSnapshot {
  return {
    version: LUCID_HEALTHKIT_SNAPSHOT_VERSION,
    status: 'empty',
    importedAt: null,
    rangeStartMs: null,
    rangeEndMs: null,
    normalization: null,
    emptyReason: null,
  };
}

function isFiniteMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteMs(value: unknown): value is number | null {
  return value === null || isFiniteMs(value);
}

function isAllowedString(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === 'string' && allowed.includes(value);
}

function isSafeIssue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const issue = value as { kind?: unknown; sampleIds?: unknown; detail?: unknown };
  if (!isAllowedString(issue.kind, LUCID_HK_SLEEP_ISSUES)) return false;
  if (typeof issue.detail !== 'string') return false;
  if (issue.sampleIds !== undefined) {
    if (!Array.isArray(issue.sampleIds) || issue.sampleIds.some((id) => typeof id !== 'string')) return false;
  }
  return true;
}

function isSafeSample(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const sample = value as {
    id?: unknown;
    startMs?: unknown;
    endMs?: unknown;
    categoryValue?: unknown;
    category?: unknown;
    sourceName?: unknown;
    sourceBundleId?: unknown;
  };
  const category = normalizeLucidHkSleepCategoryValue(sample.categoryValue);
  return (
    typeof sample.id === 'string' &&
    isFiniteMs(sample.startMs) &&
    isFiniteMs(sample.endMs) &&
    sample.endMs > sample.startMs &&
    typeof sample.categoryValue === 'number' &&
    (LUCID_HK_SLEEP_CATEGORY_VALUES as readonly number[]).includes(sample.categoryValue) &&
    category !== null &&
    sample.category === category &&
    (sample.sourceName === null || typeof sample.sourceName === 'string') &&
    (sample.sourceBundleId === null || typeof sample.sourceBundleId === 'string')
  );
}

function isSafeNormalization(value: unknown): value is LucidHkSleepNormalization {
  if (!value || typeof value !== 'object') return false;
  const normalization = value as LucidHkSleepNormalization;
  return (
    Array.isArray(normalization.samples) &&
    normalization.samples.every(isSafeSample) &&
    Array.isArray(normalization.rejected) &&
    normalization.rejected.every(isSafeIssue) &&
    Array.isArray(normalization.issues) &&
    normalization.issues.every(isSafeIssue) &&
    Array.isArray(normalization.sourceNames) &&
    normalization.sourceNames.every((item) => typeof item === 'string') &&
    Array.isArray(normalization.sourceBundleIds) &&
    normalization.sourceBundleIds.every((item) => typeof item === 'string') &&
    isAllowedString(normalization.granularity, LUCID_HK_SLEEP_GRANULARITIES) &&
    typeof normalization.hasOverlaps === 'boolean' &&
    typeof normalization.hasContradictions === 'boolean' &&
    typeof normalization.hasCoarseSamples === 'boolean' &&
    typeof normalization.hasAbsentData === 'boolean'
  );
}

function hasCompleteRange(snapshot: LucidHealthKitSnapshot): boolean {
  return (
    isFiniteMs(snapshot.importedAt) &&
    isFiniteMs(snapshot.rangeStartMs) &&
    isFiniteMs(snapshot.rangeEndMs) &&
    snapshot.rangeEndMs > snapshot.rangeStartMs
  );
}

function isSnapshot(value: unknown): value is LucidHealthKitSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as LucidHealthKitSnapshot;
  if (snapshot.version !== LUCID_HEALTHKIT_SNAPSHOT_VERSION) return false;
  if (!(SNAPSHOT_STATUSES as readonly string[]).includes(snapshot.status)) return false;
  if (!isNullableFiniteMs(snapshot.importedAt)) return false;
  if (!isNullableFiniteMs(snapshot.rangeStartMs) || !isNullableFiniteMs(snapshot.rangeEndMs)) return false;
  if (
    snapshot.rangeStartMs !== null &&
    snapshot.rangeEndMs !== null &&
    snapshot.rangeEndMs <= snapshot.rangeStartMs
  ) {
    return false;
  }
  if (snapshot.emptyReason !== null && snapshot.emptyReason !== 'ambiguous_empty') return false;
  if (snapshot.normalization !== null && !isSafeNormalization(snapshot.normalization)) return false;
  if (snapshot.status === 'imported') {
    return hasCompleteRange(snapshot) && snapshot.normalization !== null && snapshot.emptyReason === null;
  }
  if (snapshot.status === 'empty' && snapshot.emptyReason === 'ambiguous_empty') {
    return hasCompleteRange(snapshot) && snapshot.normalization === null;
  }
  if (snapshot.status === 'disabled') {
    return hasCompleteRange(snapshot) && snapshot.normalization !== null && snapshot.emptyReason === null;
  }
  return (
    snapshot.status === 'empty' &&
    snapshot.emptyReason === null &&
    snapshot.normalization === null &&
    snapshot.importedAt === null &&
    snapshot.rangeStartMs === null &&
    snapshot.rangeEndMs === null
  );
}

export async function loadLucidHealthKitSnapshot(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidHealthKitSnapshot> {
  const key = getLucidHealthKitStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) return emptySnapshot();
  try {
    const parsed = JSON.parse(plaintext) as unknown;
    if (isSnapshot(parsed)) return parsed;
  } catch {
    // Corrupt JSON is treated as an empty local snapshot.
  }
  await storage.removeItem(key).catch(() => undefined);
  return emptySnapshot();
}

export async function saveLucidHealthKitSnapshot(
  userScope: string,
  snapshot: LucidHealthKitSnapshot,
  storage: AsyncKeyValueStorage = Storage
): Promise<void> {
  if (!isSnapshot(snapshot)) {
    throw new Error('Invalid Lucid HealthKit snapshot');
  }
  await writePlaintext(getLucidHealthKitStorageKey(userScope), JSON.stringify(snapshot), storage);
}

export async function importLucidHealthKitSnapshot(
  userScope: string,
  input: {
    importedAt: number;
    rangeStartMs: number;
    rangeEndMs: number;
    normalization: LucidHkSleepNormalization;
  },
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidHealthKitSnapshot> {
  const snapshot: LucidHealthKitSnapshot = {
    version: LUCID_HEALTHKIT_SNAPSHOT_VERSION,
    status: 'imported',
    importedAt: input.importedAt,
    rangeStartMs: input.rangeStartMs,
    rangeEndMs: input.rangeEndMs,
    normalization: input.normalization,
    emptyReason: null,
  };
  await saveLucidHealthKitSnapshot(userScope, snapshot, storage);
  return snapshot;
}

export async function recordLucidHealthKitEmptySnapshot(
  userScope: string,
  input: {
    importedAt: number;
    rangeStartMs: number;
    rangeEndMs: number;
    emptyReason: 'ambiguous_empty';
  },
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidHealthKitSnapshot> {
  const snapshot: LucidHealthKitSnapshot = {
    version: LUCID_HEALTHKIT_SNAPSHOT_VERSION,
    status: 'empty',
    importedAt: input.importedAt,
    rangeStartMs: input.rangeStartMs,
    rangeEndMs: input.rangeEndMs,
    normalization: null,
    emptyReason: input.emptyReason,
  };
  await saveLucidHealthKitSnapshot(userScope, snapshot, storage);
  return snapshot;
}

export async function disableLucidHealthKitSnapshot(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidHealthKitSnapshot> {
  const current = await loadLucidHealthKitSnapshot(userScope, storage);
  const snapshot: LucidHealthKitSnapshot = {
    ...current,
    status: 'disabled',
  };
  await saveLucidHealthKitSnapshot(userScope, snapshot, storage);
  return snapshot;
}

export async function deleteLucidHealthKitSnapshot(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidHealthKitSnapshot> {
  await storage.removeItem(getLucidHealthKitStorageKey(userScope));
  return emptySnapshot();
}
