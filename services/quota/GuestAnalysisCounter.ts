/**
 * GuestAnalysisCounter - Persistent local counter for guest quota tracking
 *
 * This module provides a cumulative counter that tracks total analyses/explorations
 * performed by guest users, preventing the quota bypass vulnerability where
 * guests could delete dreams to reset their quota.
 *
 * The counter is stored in AsyncStorage and is never decremented.
 * It syncs with the server using max(local, server) to prevent discrepancies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSavedDreams } from '@/services/storageServiceReal';
import { getAnalyzedDreamCount, getExploredDreamCount } from '@/lib/dreamUsage';
import { countAiGeneratedImages } from './imageUsage';

const ANALYSIS_KEY = 'guest_total_analysis_count_v1';
const EXPLORATION_KEY = 'guest_total_exploration_count_v1';
const IMAGE_KEY = 'guest_total_image_count_v1';
const MIGRATION_KEY = 'guest_quota_migrated_v1';

type GuestQuotaCountType = 'analysis' | 'exploration' | 'image';

const COUNT_KEYS: Record<GuestQuotaCountType, string> = {
  analysis: ANALYSIS_KEY,
  exploration: EXPLORATION_KEY,
  image: IMAGE_KEY,
};

/**
 * Safely parse an integer from storage, returning 0 for invalid/corrupted values
 */
function safeParseInt(val: string | null): number {
  if (!val) return 0;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the local analysis count
 */
export async function getLocalAnalysisCount(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(ANALYSIS_KEY);
    return safeParseInt(val);
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to get analysis count:', error);
    return 0;
  }
}

/**
 * Get the local exploration count
 */
export async function getLocalExplorationCount(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(EXPLORATION_KEY);
    return safeParseInt(val);
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to get exploration count:', error);
    return 0;
  }
}

/**
 * Get the local illustration count (separate from analysis)
 */
export async function getLocalImageCount(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(IMAGE_KEY);
    return safeParseInt(val);
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to get image count:', error);
    return 0;
  }
}

/**
 * Increment the local analysis count
 * @returns The new count after incrementing
 */
export async function incrementLocalAnalysisCount(): Promise<number> {
  try {
    const current = await getLocalAnalysisCount();
    const newCount = current + 1;
    await AsyncStorage.setItem(ANALYSIS_KEY, String(newCount));
    return newCount;
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to increment analysis count:', error);
    throw error;
  }
}

/**
 * Increment the local exploration count
 * @returns The new count after incrementing
 */
export async function incrementLocalExplorationCount(): Promise<number> {
  try {
    const current = await getLocalExplorationCount();
    const newCount = current + 1;
    await AsyncStorage.setItem(EXPLORATION_KEY, String(newCount));
    return newCount;
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to increment exploration count:', error);
    throw error;
  }
}

/**
 * Increment the local illustration count
 * @returns The new count after incrementing
 */
export async function incrementLocalImageCount(): Promise<number> {
  try {
    const current = await getLocalImageCount();
    const newCount = current + 1;
    await AsyncStorage.setItem(IMAGE_KEY, String(newCount));
    return newCount;
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to increment image count:', error);
    throw error;
  }
}

/**
 * Sync local count with server count, taking the maximum to prevent discrepancies
 * This is called when we receive the server's count and want to ensure our local
 * count is at least as high.
 *
 * @param serverCount The count returned by the server
 * @param type The type of quota to sync
 * @returns The synchronized count (max of local and server)
 */
export async function syncWithServerCount(
  serverCount: number,
  type: GuestQuotaCountType
): Promise<number> {
  try {
    const key = COUNT_KEYS[type];
    const local =
      type === 'analysis'
        ? await getLocalAnalysisCount()
        : type === 'exploration'
          ? await getLocalExplorationCount()
          : await getLocalImageCount();

    const maxCount = Math.max(local, serverCount);
    await AsyncStorage.setItem(key, String(maxCount));

    if (maxCount !== local) {
      console.log(`[GuestAnalysisCounter] Synced ${type} count: local=${local}, server=${serverCount}, result=${maxCount}`);
    }

    return maxCount;
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Failed to sync with server count:', error);
    throw error;
  }
}

/**
 * Migrate existing guest users to the new counter system.
 * This should be called once on app startup.
 *
 * For existing users, we initialize the counter from the current dream count
 * so they don't lose their quota position.
 */
export async function migrateExistingGuestQuota(): Promise<void> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated) {
      return; // Already migrated
    }

    // Get current dream counts
    const dreams = await getSavedDreams();
    const analysisCount = getAnalyzedDreamCount(dreams);
    const explorationCount = getExploredDreamCount(dreams);
    const imageCount = countAiGeneratedImages(dreams);

    // Initialize counters if there's existing usage
    if (analysisCount > 0) {
      await AsyncStorage.setItem(ANALYSIS_KEY, String(analysisCount));
      console.log(`[GuestAnalysisCounter] Migrated analysis count: ${analysisCount}`);
    }

    if (explorationCount > 0) {
      await AsyncStorage.setItem(EXPLORATION_KEY, String(explorationCount));
      console.log(`[GuestAnalysisCounter] Migrated exploration count: ${explorationCount}`);
    }

    if (imageCount > 0) {
      await AsyncStorage.setItem(IMAGE_KEY, String(imageCount));
      console.log(`[GuestAnalysisCounter] Migrated image count: ${imageCount}`);
    }

    // Mark migration as complete
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    console.log('[GuestAnalysisCounter] Migration complete');
  } catch (error) {
    console.warn('[GuestAnalysisCounter] Migration failed:', error);
    // Don't throw - we don't want to block app startup
  }
}

/** Clears local compatibility counters before a server-authorized QA guest run. */
export async function resetGuestAnalysisQuotaForQa(): Promise<void> {
  await AsyncStorage.multiRemove([ANALYSIS_KEY, EXPLORATION_KEY, IMAGE_KEY, MIGRATION_KEY]);
}
