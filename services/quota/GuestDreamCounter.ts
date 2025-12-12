/**
 * GuestDreamCounter - Persistent local counter for guest dream recordings
 *
 * This module stores a cumulative "recorded dreams" counter for guest users.
 * It prevents quota bypass where a guest deletes dreams to record more.
 *
 * The counter is stored in AsyncStorage and is never decremented.
 * We compute usage as max(localCounter, currentDreamCount).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSavedDreams } from '@/services/storageServiceReal';

const DREAM_RECORDING_KEY = 'guest_total_dream_recording_count_v1';
const MIGRATION_KEY = 'guest_dream_recording_migrated_v1';

let recordingLock: Promise<void> = Promise.resolve();

export async function withGuestDreamRecordingLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = recordingLock.then(fn, fn);
  recordingLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function safeParseInt(val: string | null): number {
  if (!val) return 0;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function getLocalDreamRecordingCount(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(DREAM_RECORDING_KEY);
    return safeParseInt(val);
  } catch (error) {
    console.warn('[GuestDreamCounter] Failed to get recording count:', error);
    return 0;
  }
}

export async function incrementLocalDreamRecordingCount(): Promise<number> {
  try {
    const current = await getLocalDreamRecordingCount();
    const next = current + 1;
    await AsyncStorage.setItem(DREAM_RECORDING_KEY, String(next));
    return next;
  } catch (error) {
    console.warn('[GuestDreamCounter] Failed to increment recording count:', error);
    throw error;
  }
}

/**
 * Returns the effective used recording count for quota checks.
 * Uses max(localCounter, currentDreamCount) so deletions don't reduce usage.
 */
export async function getGuestRecordedDreamCount(currentDreamCount: number): Promise<number> {
  const local = await getLocalDreamRecordingCount();
  return Math.max(local, currentDreamCount);
}

/**
 * One-time migration: initialize the counter from currently saved dreams.
 * This ensures existing guest users don't regain quota by upgrading the app.
 */
export async function migrateExistingGuestDreamRecording(): Promise<void> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated) return;

    const dreams = await getSavedDreams();
    const count = Array.isArray(dreams) ? dreams.length : 0;

    if (count > 0) {
      await AsyncStorage.setItem(DREAM_RECORDING_KEY, String(count));
      console.log(`[GuestDreamCounter] Migrated recording count: ${count}`);
    }

    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.warn('[GuestDreamCounter] Migration failed:', error);
  }
}
