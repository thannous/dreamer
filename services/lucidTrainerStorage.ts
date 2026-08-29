import Storage from 'expo-sqlite/kv-store';

import { canonicalLucidJson, createInitialLucidTrainerState } from '@/lib/lucid/domain';
import {
  LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT,
  compareLucidDreamAtlasIds,
  createEmptyLucidDreamAtlasOverlay,
  type LucidDreamAtlasOverlay,
} from '@/lib/lucid/dreamAtlas';
import {
  assertLucidTrainerState,
  isLucidSyncMutation,
  type LucidLocale,
  type LucidSyncMutation,
  type LucidTrainerState,
} from '@/lib/lucid/model';
import {
  clearLucidDreamAtlasPreferences,
  companionHasLucidDreamAtlasData,
  inspectLucidDreamAtlasCompanion,
  overlayFromLucidDreamAtlasCompanion,
} from '@/services/lucidDreamAtlasStorage';
import { clearLucidDreamRehearsalState } from '@/services/lucidDreamRehearsalStorage';
import { deleteLucidHealthKitSnapshot } from '@/services/lucidHealthKitStorage';
import { clearLucidSsildSensoryLabCurrentSession } from '@/services/lucidSsildSensoryLabStorage';
import { clearLucidStabilizationLabSessions } from '@/services/lucidStabilizationLabStorage';
import {
  isLucidTrainerEncryptedValue,
  isLucidTrainerEncryptedValueError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_trainer';
const STATE_KEY_VERSION = 'state_v1';
const QUEUE_KEY_VERSION = 'sync_queue_v1';
const LEGACY_EXPORT_VERSION = 1 as const;
const EXPORT_VERSION = 2 as const;

type AsyncKeyValueStorage = Pick<typeof Storage, 'getItem' | 'setItem' | 'removeItem'>;

function usesNativeStorage(storage: AsyncKeyValueStorage): boolean {
  return storage === Storage;
}

async function readValue(
  key: string,
  storage: AsyncKeyValueStorage
): Promise<{ plaintext: string; needsMigration: boolean } | null> {
  const value = await storage.getItem(key);
  if (!value) return null;
  if (!usesNativeStorage(storage)) {
    return { plaintext: value, needsMigration: false };
  }
  try {
    const plaintext = await revealLucidTrainerStoredValue(key, value);
    return {
      plaintext,
      needsMigration: !isLucidTrainerEncryptedValue(value),
    };
  } catch (error) {
    if (isLucidTrainerEncryptedValueError(error)) {
      await storage.removeItem(key).catch(() => undefined);
    }
    throw error;
  }
}

async function migratePlaintextValue(
  key: string,
  plaintext: string,
  storage: AsyncKeyValueStorage
): Promise<void> {
  if (!usesNativeStorage(storage)) return;
  try {
    await storage.setItem(
      key,
      await protectLucidTrainerStoredValue(key, plaintext)
    );
  } catch {
    // Keep the valid plaintext available and retry migration on the next load.
  }
}

async function writeValue(
  key: string,
  value: string,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const protectedValue = usesNativeStorage(storage)
    ? await protectLucidTrainerStoredValue(key, value)
    : value;
  await storage.setItem(key, protectedValue);
}

export interface LucidTrainerStorageDefaults {
  now?: number;
  timeZone?: string;
  locale?: LucidLocale;
}

export interface LucidTrainerLoadResult {
  state: LucidTrainerState;
  source: 'stored' | 'empty' | 'recovered';
}

export interface LucidTrainerExportEnvelope {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  state: LucidTrainerState;
}

export { EXPORT_VERSION, LEGACY_EXPORT_VERSION };

const locks = new Map<string, Promise<void>>();

function assertUserScope(userScope: string): void {
  if (!userScope.trim() || userScope.length > 256) {
    throw new Error('Invalid Lucid Trainer user scope');
  }
}

function scopedKey(userScope: string, suffix: string): string {
  assertUserScope(userScope);
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(userScope)}:${suffix}`;
}

export function getLucidTrainerStorageKeys(userScope: string): {
  state: string;
  syncQueue: string;
} {
  return {
    state: scopedKey(userScope, STATE_KEY_VERSION),
    syncQueue: scopedKey(userScope, QUEUE_KEY_VERSION),
  };
}

function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function createDefaults(defaults: LucidTrainerStorageDefaults = {}): LucidTrainerState {
  return createInitialLucidTrainerState({
    now: defaults.now ?? Date.now(),
    timeZone: defaults.timeZone ?? systemTimeZone(),
    locale: defaults.locale,
  });
}

async function runSerialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(task);
  const tail = operation.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, tail);
  try {
    return await operation;
  } finally {
    if (locks.get(key) === tail) {
      locks.delete(key);
    }
  }
}

function isPristineDreamAtlas(overlay: LucidDreamAtlasOverlay | undefined): boolean {
  return (
    overlay == null ||
    (overlay.updatedAt === LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT &&
      !companionHasLucidDreamAtlasData(overlay))
  );
}

function withPristineDreamAtlas(state: LucidTrainerState): LucidTrainerState {
  if (state.dreamAtlas != null) return state;
  return {
    ...state,
    dreamAtlas: createEmptyLucidDreamAtlasOverlay(LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT),
  };
}

async function persistTrainerState(
  userScope: string,
  state: LucidTrainerState,
  storage: AsyncKeyValueStorage
): Promise<void> {
  assertLucidTrainerState(state);
  await writeValue(getLucidTrainerStorageKeys(userScope).state, JSON.stringify(state), storage);
}

async function dropCompanionAfterMainWrite(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<void> {
  try {
    await clearLucidDreamAtlasPreferences(userScope, storage);
  } catch {
    // Main SoT already won; a later load retries this drop only.
  }
}

async function migrateCompanionDreamAtlas(
  userScope: string,
  state: LucidTrainerState,
  source: LucidTrainerLoadResult['source'],
  defaults: LucidTrainerStorageDefaults,
  storage: AsyncKeyValueStorage
): Promise<LucidTrainerLoadResult> {
  const companion = await inspectLucidDreamAtlasCompanion(userScope, storage);
  const nextState = withPristineDreamAtlas(state);
  const needsPristineUpgrade = state.dreamAtlas == null;

  if (companion.status === 'absent') {
    if (!needsPristineUpgrade || source !== 'stored') {
      return { state: nextState, source };
    }
    await persistTrainerState(userScope, nextState, storage);
    return { state: nextState, source };
  }

  if (!isPristineDreamAtlas(nextState.dreamAtlas)) {
    await dropCompanionAfterMainWrite(userScope, storage);
    return { state: nextState, source };
  }

  if (!companionHasLucidDreamAtlasData(companion.preferences)) {
    if (needsPristineUpgrade && source === 'stored') {
      await persistTrainerState(userScope, nextState, storage);
    }
    await dropCompanionAfterMainWrite(userScope, storage);
    return { state: nextState, source };
  }

  const stamped = overlayFromLucidDreamAtlasCompanion(
    companion.preferences,
    defaults.now ?? Date.now()
  );
  const migrated: LucidTrainerState = {
    ...nextState,
    dreamAtlas: stamped,
    updatedAt: Math.max(nextState.updatedAt, stamped.updatedAt),
  };
  await persistTrainerState(userScope, migrated, storage);
  await dropCompanionAfterMainWrite(userScope, storage);
  return { state: migrated, source };
}

export async function loadLucidTrainerState(
  userScope: string,
  defaults: LucidTrainerStorageDefaults = {},
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidTrainerLoadResult> {
  const key = getLucidTrainerStorageKeys(userScope).state;
  let stored: Awaited<ReturnType<typeof readValue>>;
  try {
    stored = await readValue(key, storage);
  } catch (error) {
    if (isLucidTrainerEncryptedValueError(error)) {
      const recovered = await migrateCompanionDreamAtlas(
        userScope,
        createDefaults(defaults),
        'recovered',
        defaults,
        storage
      );
      return recovered;
    }
    throw error;
  }
  if (!stored) {
    return migrateCompanionDreamAtlas(
      userScope,
      createDefaults(defaults),
      'empty',
      defaults,
      storage
    );
  }

  let value: LucidTrainerState;
  try {
    const parsed: unknown = JSON.parse(stored.plaintext);
    assertLucidTrainerState(parsed);
    value = parsed;
  } catch {
    await storage.removeItem(key).catch(() => undefined);
    return migrateCompanionDreamAtlas(
      userScope,
      createDefaults(defaults),
      'recovered',
      defaults,
      storage
    );
  }
  if (stored.needsMigration) {
    await migratePlaintextValue(key, stored.plaintext, storage);
  }
  return migrateCompanionDreamAtlas(userScope, value, 'stored', defaults, storage);
}

export async function getLucidTrainerState(
  userScope: string,
  defaults: LucidTrainerStorageDefaults = {},
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidTrainerState> {
  return (await loadLucidTrainerState(userScope, defaults, storage)).state;
}

export async function saveLucidTrainerState(
  userScope: string,
  state: LucidTrainerState,
  storage: AsyncKeyValueStorage = Storage
): Promise<void> {
  assertLucidTrainerState(state);
  const key = getLucidTrainerStorageKeys(userScope).state;
  await writeValue(key, JSON.stringify(state), storage);
}

export async function updateLucidTrainerState(
  userScope: string,
  updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>,
  defaults: LucidTrainerStorageDefaults = {},
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidTrainerState> {
  const key = getLucidTrainerStorageKeys(userScope).state;
  return runSerialized(key, async () => {
    const current = await getLucidTrainerState(userScope, defaults, storage);
    const next = await updater(current);
    assertLucidTrainerState(next);
    await writeValue(key, JSON.stringify(next), storage);
    return next;
  });
}

export async function loadLucidTrainerSyncQueue(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSyncMutation[]> {
  const key = getLucidTrainerStorageKeys(userScope).syncQueue;
  let stored: Awaited<ReturnType<typeof readValue>>;
  try {
    stored = await readValue(key, storage);
  } catch (error) {
    if (isLucidTrainerEncryptedValueError(error)) return [];
    throw error;
  }
  if (!stored) return [];

  try {
    const value: unknown = JSON.parse(stored.plaintext);
    if (!Array.isArray(value) || !value.every(isLucidSyncMutation)) {
      await storage.removeItem(key).catch(() => undefined);
      return [];
    }
    const scoped = value.filter((mutation) => mutation.userScope === userScope);
    if (stored.needsMigration) {
      await migratePlaintextValue(key, stored.plaintext, storage);
    }
    return scoped;
  } catch {
    await storage.removeItem(key).catch(() => undefined);
    return [];
  }
}

export async function saveLucidTrainerSyncQueue(
  userScope: string,
  queue: readonly LucidSyncMutation[],
  storage: AsyncKeyValueStorage = Storage
): Promise<void> {
  if (
    queue.some(
      (mutation) => !isLucidSyncMutation(mutation) || mutation.userScope !== userScope
    )
  ) {
    throw new Error('Invalid Lucid Trainer sync queue');
  }
  const key = getLucidTrainerStorageKeys(userScope).syncQueue;
  await writeValue(key, JSON.stringify(queue), storage);
}

export async function updateLucidTrainerSyncQueue(
  userScope: string,
  updater: (
    current: LucidSyncMutation[]
  ) => readonly LucidSyncMutation[] | Promise<readonly LucidSyncMutation[]>,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSyncMutation[]> {
  const key = getLucidTrainerStorageKeys(userScope).syncQueue;
  return runSerialized(key, async () => {
    const current = await loadLucidTrainerSyncQueue(userScope, storage);
    const next = [...(await updater(current))];
    if (
      next.some(
        (mutation) => !isLucidSyncMutation(mutation) || mutation.userScope !== userScope
      )
    ) {
      throw new Error('Invalid Lucid Trainer sync queue');
    }
    await writeValue(key, JSON.stringify(next), storage);
    return next;
  });
}

export async function appendLucidTrainerSyncMutation(
  userScope: string,
  mutation: LucidSyncMutation,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSyncMutation[]> {
  if (!isLucidSyncMutation(mutation) || mutation.userScope !== userScope) {
    throw new Error('Invalid Lucid Trainer sync mutation');
  }
  return updateLucidTrainerSyncQueue(userScope, (current) => {
    if (current.some((entry) => entry.clientRequestId === mutation.clientRequestId)) {
      return current;
    }
    return [...current, mutation].sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
    );
  }, storage);
}

export async function clearLucidTrainerLocalData(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage,
  cancelReminders: () => Promise<unknown> = async () => {
    const { cancelAllLucidTrainerNotifications } = await import(
      '@/services/lucidTrainerNotifications'
    );
    return cancelAllLucidTrainerNotifications();
  }
): Promise<void> {
  const keys = getLucidTrainerStorageKeys(userScope);
  await runSerialized(keys.state, () =>
    runSerialized(keys.syncQueue, async () => {
      let cancellationError: unknown;
      try {
        await cancelReminders();
      } catch (error) {
        cancellationError = error;
      }
      await Promise.all([storage.removeItem(keys.state), storage.removeItem(keys.syncQueue)]);
      const companionResults = await Promise.allSettled([
        deleteLucidHealthKitSnapshot(userScope, storage),
        clearLucidDreamRehearsalState(userScope, storage),
        clearLucidDreamAtlasPreferences(userScope, storage),
        clearLucidStabilizationLabSessions(userScope, storage),
        clearLucidSsildSensoryLabCurrentSession(userScope, storage),
      ]);
      if (cancellationError) throw cancellationError;
      const companionFailure = companionResults.find((result) => result.status === 'rejected');
      if (companionFailure?.status === 'rejected') throw companionFailure.reason;
    })
  );
}

function sortedAtlasEntries(record: Record<string, string>): [string, string][] {
  return Object.entries(record).sort(([left], [right]) => compareLucidDreamAtlasIds(left, right));
}

function atlasCsvDetails(payload: Record<string, string>): string {
  return canonicalLucidJson(payload);
}

function appendAtlasPreferenceRows(
  rows: (string | number | boolean | null | undefined)[][],
  overlay: LucidDreamAtlasOverlay
): void {
  const preferences = overlay;
  for (const [nodeId, label] of sortedAtlasEntries(preferences.renamed)) {
    rows.push([
      'atlas_rename',
      nodeId,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      atlasCsvDetails({ label }),
    ]);
  }
  for (const nodeId of [...preferences.hidden].sort(compareLucidDreamAtlasIds)) {
    rows.push(['atlas_hide', nodeId, '', '', '', '', '', '', '', '', '', '']);
  }
  for (const [fromId, intoId] of sortedAtlasEntries(preferences.merges)) {
    rows.push([
      'atlas_merge',
      fromId,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      atlasCsvDetails({ intoId }),
    ]);
  }
  for (const nodeId of [...preferences.deleted].sort(compareLucidDreamAtlasIds)) {
    rows.push(['atlas_delete', nodeId, '', '', '', '', '', '', '', '', '', '']);
  }
}

export function exportLucidTrainerJson(state: LucidTrainerState, now = Date.now()): string {
  assertLucidTrainerState(state);
  const envelope: LucidTrainerExportEnvelope = {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

function protectSpreadsheetCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const raw = protectSpreadsheetCell(value == null ? '' : String(value));
  return `"${raw.replace(/"/g, '""')}"`;
}

export function exportLucidTrainerCsv(state: LucidTrainerState): string {
  assertLucidTrainerState(state);
  const rows: (string | number | boolean | null | undefined)[][] = [
    [
      'record_type',
      'id',
      'occurred_at',
      'technique',
      'result',
      'lucidity_level',
      'recall_level',
      'sleep_quality',
      'context',
      'method',
      'outcome',
      'details',
    ],
  ];

  state.progress.forEach((progress) => {
    rows.push([
      'program_progress',
      progress.technique,
      progress.startedAt ? new Date(progress.startedAt).toISOString() : '',
      progress.technique,
      progress.status,
      '',
      '',
      '',
      '',
      '',
      '',
      canonicalLucidJson({
        currentDay: progress.currentDay,
        completedExerciseIds: progress.completedExerciseIds,
        practiceDates: progress.practiceDates,
      }),
    ]);
  });
  state.experiments.forEach((experiment) => {
    rows.push([
      'experiment',
      experiment.id,
      new Date(experiment.occurredAt).toISOString(),
      experiment.technique,
      experiment.result,
      experiment.lucidityLevel,
      experiment.recallLevel,
      experiment.sleepQuality,
      '',
      '',
      '',
      canonicalLucidJson({
        preparationMinutes: experiment.preparationMinutes,
        factors: experiment.factors,
        notes: experiment.notes ?? '',
        ...(experiment.captureMode !== undefined ? { captureMode: experiment.captureMode } : {}),
        ...(experiment.recallText !== undefined ? { recallText: experiment.recallText } : {}),
        ...(experiment.cueOutcome !== undefined ? { cueOutcome: experiment.cueOutcome } : {}),
        ...(experiment.voiceCapture !== undefined ? { voiceCapture: experiment.voiceCapture } : {}),
        ...(experiment.techniqueAutoLink !== undefined
          ? { techniqueAutoLink: experiment.techniqueAutoLink }
          : {}),
      }),
    ]);
  });
  state.realityChecks.forEach((check) => {
    rows.push([
      'reality_check',
      check.id,
      new Date(check.occurredAt).toISOString(),
      '',
      '',
      '',
      '',
      '',
      check.context,
      check.method,
      check.outcome,
      canonicalLucidJson({
        mindful: check.mindful,
        ...(check.observedDetail ? { observedDetail: check.observedDetail } : {}),
        ...(check.arrivalPath ? { arrivalPath: check.arrivalPath } : {}),
        ...(check.nextDreamIntention
          ? { nextDreamIntention: check.nextDreamIntention }
          : {}),
        ...(check.mindfulPauseAnchor
          ? { mindfulPauseAnchor: check.mindfulPauseAnchor }
          : {}),
        ...(check.dreamSignId ? { dreamSignId: check.dreamSignId } : {}),
        ...(check.dreamSignLabel ? { dreamSignLabel: check.dreamSignLabel } : {}),
      }),
    ]);
  });
  state.weeklyReviews.forEach((review) => {
    rows.push([
      'weekly_review',
      review.id,
      new Date(review.completedAt).toISOString(),
      review.recommendedTechnique ?? '',
      '',
      '',
      review.recallDays,
      '',
      '',
      '',
      '',
      canonicalLucidJson({
        weekStart: review.weekStart,
        practiceDays: review.practiceDays,
        lucidDreams: review.lucidDreams,
        notes: review.notes ?? '',
      }),
    ]);
  });
  (state.dreamSignDecisions ?? []).forEach((sign) => {
    rows.push([
      'dream_sign',
      sign.id,
      new Date(sign.updatedAt).toISOString(),
      '',
      sign.decision,
      '',
      '',
      '',
      '',
      '',
      '',
      canonicalLucidJson({
        customLabel: sign.customLabel ?? '',
        sourceDreamIds: sign.sourceDreamIds,
      }),
    ]);
  });

  if (state.dreamAtlas) {
    appendAtlasPreferenceRows(rows, state.dreamAtlas);
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
