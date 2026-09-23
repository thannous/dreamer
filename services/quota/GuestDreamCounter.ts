/**
 * Cumulative guest recording allowance. A reservation and its dream identity
 * share one durable record so an interrupted journal write can be reconciled.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { requireReadableDreams } from '@/lib/dreamStorageRead';
import { isMockModeEnabled } from '@/lib/env';
import { GuestDreamLimitError } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
import { getSavedDreams } from '@/services/storageService';

const LEGACY_COUNT_KEY = 'guest_total_dream_recording_count_v1';
const RECORDING_STATE_KEY = 'guest_dream_recording_state_v2';
const MIGRATION_KEY = 'guest_dream_recording_migrated_v1';

type RecordingIdentity = Pick<DreamAnalysis, 'id' | 'clientRequestId'>;
type RecordingState = {
  count: number;
  pending: { identity: string; previousCount: number } | null;
};

let recordingLock: Promise<void> = Promise.resolve();
const recordingCountListeners = new Set<() => void>();
/** Mock dreams live in memory; keep their allowance in the same session. */
let mockSessionState: RecordingState = { count: 0, pending: null };

const emitRecordingCountChange = () => {
  recordingCountListeners.forEach((listener) => listener());
};

export function subscribeGuestDreamRecordingCount(listener: () => void): () => void {
  recordingCountListeners.add(listener);
  return () => {
    recordingCountListeners.delete(listener);
  };
}

export async function withGuestDreamRecordingLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = recordingLock.then(fn, fn);
  recordingLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function requireStoredCount(value: string | null): number {
  if (value === null) return 0;
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('Invalid guest recording count');
  const count = Number(value);
  if (!Number.isSafeInteger(count)) throw new Error('Invalid guest recording count');
  return count;
}

function requireRecordingState(value: string): RecordingState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid guest recording state');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid guest recording state');
  const { count, pending } = parsed as Partial<RecordingState>;
  if (!Number.isSafeInteger(count) || (count ?? -1) < 0) {
    throw new Error('Invalid guest recording state');
  }
  if (pending !== null && (
    !pending || typeof pending !== 'object' ||
    typeof pending.identity !== 'string' || !pending.identity ||
    !Number.isSafeInteger(pending.previousCount) ||
    pending.previousCount < 0 || count !== pending.previousCount + 1
  )) {
    throw new Error('Invalid guest recording state');
  }
  return { count: count as number, pending: pending ?? null };
}

async function readState(): Promise<RecordingState> {
  if (isMockModeEnabled()) return mockSessionState;
  const stored = await AsyncStorage.getItem(RECORDING_STATE_KEY);
  if (stored !== null) return requireRecordingState(stored);
  return { count: requireStoredCount(await AsyncStorage.getItem(LEGACY_COUNT_KEY)), pending: null };
}

async function writeState(state: RecordingState): Promise<void> {
  if (isMockModeEnabled()) {
    mockSessionState = state;
  } else {
    await AsyncStorage.setItem(RECORDING_STATE_KEY, JSON.stringify(state));
  }
  emitRecordingCountChange();
}

/** Must be called under the recording lock, after any guest journal write settles. */
async function reconcilePendingState(): Promise<{ state: RecordingState; outcome: 'saved' | 'absent' | 'none' }> {
  const state = await readState();
  if (!state.pending) return { state, outcome: 'none' };

  const dreams = requireReadableDreams(await getSavedDreams());
  const saved = dreams.some((dream) => getDreamIdentityKey(dream) === state.pending?.identity);
  const next: RecordingState = {
    count: saved ? state.count : state.pending.previousCount,
    pending: null,
  };
  await writeState(next);
  return { state: next, outcome: saved ? 'saved' : 'absent' };
}

/** Returns whether the reserved dream reached durable journal storage. */
export async function reconcilePendingGuestDreamRecording(): Promise<'saved' | 'absent' | 'none'> {
  return (await reconcilePendingState()).outcome;
}

/** Reserve a lifetime slot before writing a new guest dream. Called under the lock. */
export async function reserveGuestDreamRecording(
  dream: RecordingIdentity,
  currentDreamCount: number,
  limit: number
): Promise<void> {
  const { state } = await reconcilePendingState();
  const used = Math.max(state.count, currentDreamCount);
  if (used >= limit) throw new GuestDreamLimitError();
  await writeState({
    count: used + 1,
    pending: { identity: getDreamIdentityKey(dream), previousCount: used },
  });
}

/** Mark a saved dream committed, including before deleting that same dream. */
export async function commitGuestDreamRecording(dream: RecordingIdentity): Promise<void> {
  const state = await readState();
  if (!state.pending || state.pending.identity !== getDreamIdentityKey(dream)) return;
  await writeState({ count: state.count, pending: null });
}

export async function getLocalDreamRecordingCount(): Promise<number> {
  try {
    return await getGuestRecordedDreamCount(0);
  } catch (error) {
    console.warn('[GuestDreamCounter] Failed to get recording count:', error);
    return 0;
  }
}

/** Explicit mock/test reset; serialized so an in-flight save cannot restore it. */
export async function resetGuestDreamRecordingCount(): Promise<void> {
  await withGuestDreamRecordingLock(async () => {
    mockSessionState = { count: 0, pending: null };
    await AsyncStorage.multiRemove([RECORDING_STATE_KEY, LEGACY_COUNT_KEY, MIGRATION_KEY]);
    emitRecordingCountChange();
  });
}

/** A failed read never silently restores an exhausted allowance. */
export async function getGuestRecordedDreamCount(currentDreamCount: number): Promise<number> {
  return withGuestDreamRecordingLock(async () => {
    const { state } = await reconcilePendingState();
    return Math.max(state.count, currentDreamCount);
  });
}

/** Seed historical usage from dreams saved before this allowance was introduced. */
export async function migrateExistingGuestDreamRecording(): Promise<void> {
  if (isMockModeEnabled()) return;
  try {
    await withGuestDreamRecordingLock(async () => {
      const { state } = await reconcilePendingState();
      if (await AsyncStorage.getItem(MIGRATION_KEY)) return;

      const dreams = requireReadableDreams(await getSavedDreams());
      const count = Math.max(state.count, dreams.length);
      if (count > state.count) {
        await writeState({ count, pending: null });
      }
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    });
  } catch (error) {
    console.warn('[GuestDreamCounter] Migration failed:', error);
  }
}
