/**
 * Mock implementation of storageService for development mode
 * Uses in-memory storage and can optionally preload predefined dreams
 */

import { DEFAULT_DAILY_REMINDER_SETTINGS } from '@/lib/dreamerNotifications';
import {
  DEFAULT_JOURNAL_LAYOUT_PREFERENCE,
  DEFAULT_LANGUAGE_PREFERENCE,
  DEFAULT_THEME_PREFERENCE,
  GUEST_RECORDING_DRAFT_KEY,
  isJournalLayoutPreference,
  recordingDraftKey,
  scopedStorageKey,
  storageKeys,
} from '@/services/storageSchema';
import type {
  DreamAnalysis,
  DreamListReadResult,
  DreamMutation,
  GuestDreamMigrationOwner,
  JournalLayoutPreference,
  LanguagePreference,
  NotificationSettings,
  PendingImageJob,
  RecordingDraftReadResult,
  RecordingDraftScope,
  RecordingInputModePreference,
  RitualStepProgress,
  ThemePreference,
} from '@/lib/types';
import { migrateLegacyDreamMutation } from '@/lib/dreamUtils';
import { parsePendingDreamMutationsPayload } from '@/lib/dreamMutationPayload';
import { isMockDogfoodPersistenceEnabled, isMockModeEnabled } from '@/lib/env';
import { reportSyncQueueClearedWithPending } from '@/lib/syncObservability';
import { getPredefinedDreamsWithTimestamps } from '@/mock-data/predefinedDreams';

const mockStorage: Record<string, string> = {};

let dreamsPreloaded = false;
let shouldPreloadDreams = false;

const MOCK_DOGFOOD_STORAGE_PREFIX = 'noctalia_mock_dogfood_v1:';

// Dogfood persistence is opt-in and namespaced away from real account data.
async function getMockItem(key: string): Promise<string | null> {
  if (!isMockDogfoodPersistenceEnabled()) return mockStorage[key] ?? null;
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return (await AsyncStorage.getItem(`${MOCK_DOGFOOD_STORAGE_PREFIX}${key}`)) ?? mockStorage[key] ?? null;
}

async function setMockItem(key: string, value: string): Promise<void> {
  if (isMockDogfoodPersistenceEnabled()) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(`${MOCK_DOGFOOD_STORAGE_PREFIX}${key}`, value);
  }
  mockStorage[key] = value;
}

export function setPreloadDreamsEnabled(enabled: boolean): void {
  shouldPreloadDreams = enabled;
  if (!enabled) {
    dreamsPreloaded = false;
    delete mockStorage[storageKeys.dreams];
  }
  console.log('[MOCK STORAGE] Dream preloading', enabled ? 'enabled' : 'disabled');
}

export function preloadDreamsNow(): void {
  if (!shouldPreloadDreams) {
    console.log('[MOCK STORAGE] Skipping preload because it is disabled');
    return;
  }
  ensureDreamsPreloaded();
}

/**
 * Pre-load predefined dreams on first access
 */
function ensureDreamsPreloaded(): void {
  if (dreamsPreloaded || !shouldPreloadDreams) return;

  console.log('[MOCK STORAGE] Pre-loading predefined dreams...');
  const predefinedDreams = getPredefinedDreamsWithTimestamps();
  mockStorage[storageKeys.dreams] = JSON.stringify(predefinedDreams);
  dreamsPreloaded = true;
  console.log(`[MOCK STORAGE] Loaded ${predefinedDreams.length} predefined dreams`);
}

/**
 * Mock get saved dreams
 * Returns predefined dreams on first load, then returns saved state
 */
export async function getSavedDreams(): Promise<DreamListReadResult> {
  console.log('[MOCK STORAGE] getSavedDreams called');
  ensureDreamsPreloaded();

  try {
    const savedDreams = await getMockItem(storageKeys.dreams);
    if (savedDreams !== null) {
      const dreams = JSON.parse(savedDreams) as DreamAnalysis[];
      const sorted = dreams.sort((a, b) => b.id - a.id);
      console.log(`[MOCK STORAGE] Returning ${sorted.length} dreams`);
      return { status: 'loaded', value: sorted };
    }
    return { status: 'absent' };
  } catch {
    console.error('[MOCK STORAGE] Failed to retrieve dreams');
    return { status: 'error' };
  }
}

export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  console.log(`[MOCK STORAGE] saveDreams called with ${dreams.length} dreams`);
  try {
    await setMockItem(storageKeys.dreams, JSON.stringify(dreams));
    console.log('[MOCK STORAGE] Dreams saved successfully');
  } catch {
    console.error('[MOCK STORAGE] Failed to save dreams');
    throw new Error('Failed to persist dreams to storage');
  }
}

export async function getSavedTranscript(scope: RecordingDraftScope): Promise<string> {
  console.log('[MOCK STORAGE] getSavedTranscript called');
  try {
    return await getMockItem(recordingDraftKey(scope)) ?? '';
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve transcript:', error);
    return '';
  }
}

export async function getRecordingDraft(scope: RecordingDraftScope): Promise<RecordingDraftReadResult> {
  const value = await getMockItem(recordingDraftKey(scope));
  if (value) return { status: 'loaded', value };
  const guestValue = scope === 'guest' ? null : await getMockItem(GUEST_RECORDING_DRAFT_KEY);
  if (!guestValue) return { status: 'absent' };
  // A guest draft follows the account that signs in, as in the real service.
  await setMockItem(recordingDraftKey(scope), guestValue);
  await setMockItem(GUEST_RECORDING_DRAFT_KEY, '');
  return { status: 'loaded', value: guestValue };
}

export async function saveTranscript(transcript: string, scope: RecordingDraftScope): Promise<void> {
  console.log('[MOCK STORAGE] saveTranscript called with:', transcript.slice(0, 50) + '...');
  const key = recordingDraftKey(scope);
  try {
    await setMockItem(key, transcript);
    if (!transcript) delete mockStorage[key];
    console.log('[MOCK STORAGE] Transcript saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save transcript:', error);
    throw new Error('Failed to save transcript');
  }
}

export async function clearSavedTranscript(scope: RecordingDraftScope): Promise<void> {
  console.log('[MOCK STORAGE] clearSavedTranscript called');
  try {
    delete mockStorage[recordingDraftKey(scope)];
    console.log('[MOCK STORAGE] Transcript cleared');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to clear transcript:', error);
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  console.log('[MOCK STORAGE] getNotificationSettings called');
  try {
    const savedSettings = mockStorage[storageKeys.notificationSettings];
    if (savedSettings) {
      const settings = JSON.parse(savedSettings) as NotificationSettings;
      console.log('[MOCK STORAGE] Returning saved notification settings');
      return settings;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve notification settings:', error);
  }
  console.log('[MOCK STORAGE] Returning default notification settings');
  return { ...DEFAULT_DAILY_REMINDER_SETTINGS };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  console.log('[MOCK STORAGE] saveNotificationSettings called:', settings);
  try {
    mockStorage[storageKeys.notificationSettings] = JSON.stringify(settings);
    console.log('[MOCK STORAGE] Notification settings saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save notification settings:', error);
    throw new Error('Failed to save notification settings');
  }
}

export async function getThemePreference(): Promise<ThemePreference> {
  console.log('[MOCK STORAGE] getThemePreference called');
  try {
    const savedPreference = await getMockItem(storageKeys.themePreference);
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as ThemePreference;
      console.log('[MOCK STORAGE] Returning saved theme preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve theme preference:', error);
  }
  console.log('[MOCK STORAGE] Returning default theme preference');
  return DEFAULT_THEME_PREFERENCE;
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveThemePreference called:', preference);
  try {
    await setMockItem(storageKeys.themePreference, JSON.stringify(preference));
    console.log('[MOCK STORAGE] Theme preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save theme preference:', error);
    throw new Error('Failed to save theme preference');
  }
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  console.log('[MOCK STORAGE] getLanguagePreference called');
  try {
    const savedPreference = await getMockItem(storageKeys.languagePreference);
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as LanguagePreference;
      console.log('[MOCK STORAGE] Returning saved language preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve language preference:', error);
  }
  console.log('[MOCK STORAGE] Returning default language preference');
  return DEFAULT_LANGUAGE_PREFERENCE;
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveLanguagePreference called:', preference);
  try {
    await setMockItem(storageKeys.languagePreference, JSON.stringify(preference));
    console.log('[MOCK STORAGE] Language preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save language preference:', error);
    throw new Error('Failed to save language preference');
  }
}

export async function getJournalLayoutPreference(): Promise<JournalLayoutPreference> {
  console.log('[MOCK STORAGE] getJournalLayoutPreference called');
  try {
    const savedPreference = mockStorage[storageKeys.journalLayoutPreference];
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as unknown;
      if (isJournalLayoutPreference(preference)) {
        console.log('[MOCK STORAGE] Returning saved journal layout preference:', preference);
        return preference;
      }
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve journal layout preference:', error);
  }
  console.log('[MOCK STORAGE] Returning default journal layout preference');
  return DEFAULT_JOURNAL_LAYOUT_PREFERENCE;
}

export async function saveJournalLayoutPreference(preference: JournalLayoutPreference): Promise<void> {
  console.log('[MOCK STORAGE] saveJournalLayoutPreference called:', preference);
  try {
    mockStorage[storageKeys.journalLayoutPreference] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Journal layout preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save journal layout preference:', error);
    throw new Error('Failed to save journal layout preference');
  }
}

export async function getRecordingInputModePreference(
  actorScope?: string | null
): Promise<RecordingInputModePreference | null> {
  console.log('[MOCK STORAGE] getRecordingInputModePreference called');
  try {
    const scopedKey = scopedStorageKey(storageKeys.recordingInputModePreference, actorScope);
    const savedPreference =
      (await getMockItem(scopedKey)) ??
      (actorScope === 'guest' ? await getMockItem(storageKeys.recordingInputModePreference) : undefined);
    if (savedPreference) {
      const parsed = JSON.parse(savedPreference);
      if (parsed === 'text' || parsed === 'voice') {
        return parsed;
      }
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve recording input mode preference:', error);
  }
  return null;
}

export async function saveRecordingInputModePreference(
  preference: RecordingInputModePreference,
  actorScope?: string | null
): Promise<void> {
  console.log('[MOCK STORAGE] saveRecordingInputModePreference called:', preference);
  try {
    await setMockItem(scopedStorageKey(storageKeys.recordingInputModePreference, actorScope), JSON.stringify(preference));
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save recording input mode preference:', error);
    throw new Error('Failed to save recording input mode preference');
  }
}

export async function getReminderPromptDismissed(): Promise<boolean> {
  console.log('[MOCK STORAGE] getReminderPromptDismissed called');
  try {
    const savedPreference = mockStorage[storageKeys.reminderPromptDismissed];
    if (savedPreference) {
      return JSON.parse(savedPreference) === true;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve reminder prompt state:', error);
  }
  return false;
}

export async function saveReminderPromptDismissed(dismissed: boolean): Promise<void> {
  console.log('[MOCK STORAGE] saveReminderPromptDismissed called:', dismissed);
  try {
    mockStorage[storageKeys.reminderPromptDismissed] = JSON.stringify(dismissed);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save reminder prompt state:', error);
    throw new Error('Failed to save reminder prompt state');
  }
}

export async function getStaleAnalysisBannerDismissed(): Promise<boolean> {
  console.log('[MOCK STORAGE] getStaleAnalysisBannerDismissed called');
  try {
    const savedPreference = mockStorage[storageKeys.staleAnalysisBannerDismissed];
    if (savedPreference) {
      return JSON.parse(savedPreference) === true;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve stale analysis banner state:', error);
  }
  return false;
}

export async function saveStaleAnalysisBannerDismissed(dismissed: boolean): Promise<void> {
  console.log('[MOCK STORAGE] saveStaleAnalysisBannerDismissed called:', dismissed);
  try {
    mockStorage[storageKeys.staleAnalysisBannerDismissed] = JSON.stringify(dismissed);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save stale analysis banner state:', error);
    throw new Error('Failed to save stale analysis banner state');
  }
}

export async function getRecordingVoiceHintCompleted(actorScope?: string | null): Promise<boolean> {
  console.log('[MOCK STORAGE] getRecordingVoiceHintCompleted called');
  try {
    const savedFlag = mockStorage[scopedStorageKey(storageKeys.recordingVoiceHintCompleted, actorScope)];
    if (savedFlag) {
      return JSON.parse(savedFlag) === true;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve recording voice hint flag:', error);
  }
  return false;
}

export async function saveRecordingVoiceHintCompleted(
  completed: boolean,
  actorScope?: string | null
): Promise<void> {
  console.log('[MOCK STORAGE] saveRecordingVoiceHintCompleted called:', completed);
  try {
    mockStorage[scopedStorageKey(storageKeys.recordingVoiceHintCompleted, actorScope)] =
      JSON.stringify(completed);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save recording voice hint flag:', error);
    throw new Error('Failed to save recording voice hint flag');
  }
}

export async function getRitualPreference(): Promise<string | null> {
  console.log('[MOCK STORAGE] getRitualPreference called');
  try {
    const savedPreference = mockStorage[storageKeys.ritualPreference];
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as string;
      console.log('[MOCK STORAGE] Returning saved ritual preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve ritual preference:', error);
  }
  console.log('[MOCK STORAGE] No ritual preference set yet');
  return null;
}

export async function saveRitualPreference(preference: string): Promise<void> {
  console.log('[MOCK STORAGE] saveRitualPreference called:', preference);
  try {
    mockStorage[storageKeys.ritualPreference] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Ritual preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save ritual preference:', error);
    throw new Error('Failed to save ritual preference');
  }
}

export async function getRitualStepProgress(): Promise<RitualStepProgress | null> {
  console.log('[MOCK STORAGE] getRitualStepProgress called');
  try {
    const savedProgress = mockStorage[storageKeys.ritualProgress];
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress) as RitualStepProgress;
      console.log('[MOCK STORAGE] Returning ritual step progress');
      return parsed;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve ritual step progress:', error);
  }
  console.log('[MOCK STORAGE] No ritual step progress set yet');
  return null;
}

export async function saveRitualStepProgress(progress: RitualStepProgress): Promise<void> {
  console.log('[MOCK STORAGE] saveRitualStepProgress called');
  try {
    mockStorage[storageKeys.ritualProgress] = JSON.stringify(progress);
    console.log('[MOCK STORAGE] Ritual step progress saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save ritual step progress:', error);
    throw new Error('Failed to save ritual step progress');
  }
}

export async function getFirstLaunchCompleted(): Promise<boolean> {
  console.log('[MOCK STORAGE] getFirstLaunchCompleted called');
  try {
    const savedFlag = await getMockItem(storageKeys.firstLaunchCompleted);
    if (savedFlag) {
      const completed = JSON.parse(savedFlag) as boolean;
      console.log('[MOCK STORAGE] Returning first launch flag:', completed);
      return completed;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve first launch flag:', error);
  }
  console.log('[MOCK STORAGE] No first launch flag set yet, defaulting to false');
  return false;
}

export async function saveFirstLaunchCompleted(completed: boolean): Promise<void> {
  console.log('[MOCK STORAGE] saveFirstLaunchCompleted called:', completed);
  try {
    await setMockItem(storageKeys.firstLaunchCompleted, JSON.stringify(completed));
    console.log('[MOCK STORAGE] First launch flag saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save first launch flag:', error);
    throw new Error('Failed to save first launch flag');
  }
}

export async function getLastSeenReleaseNotesVersion(): Promise<string | null> {
  const savedVersion = mockStorage[storageKeys.lastSeenReleaseNotesVersion];
  if (!savedVersion) return null;
  try {
    const parsed = JSON.parse(savedVersion) as unknown;
    return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLastSeenReleaseNotesVersion(version: string): Promise<void> {
  mockStorage[storageKeys.lastSeenReleaseNotesVersion] = JSON.stringify(version);
}

export async function getOnboardingStateSnapshot(actorScope: string): Promise<string | null> {
  return getMockItem(scopedStorageKey(storageKeys.onboardingState, actorScope));
}

/**
 * Browser QA: session storage may ask the mock to refuse the next writes that would finish the
 * introduction, as a full or locked device storage would, so its error and recovery can be played.
 */
const ONBOARDING_SAVE_FAILURES_KEY = 'noctalia.mock.onboardingSaveFailures';

function refusesOnboardingSave(serializedState: string): boolean {
  if (!isMockModeEnabled()) return false;
  const session = (globalThis as { sessionStorage?: Storage }).sessionStorage;
  if (!session) return false;
  try {
    const left = Number(session.getItem(ONBOARDING_SAVE_FAILURES_KEY));
    if (!Number.isInteger(left) || left <= 0) return false;
    const status = (JSON.parse(serializedState) as { status?: unknown }).status;
    if (status !== 'completed' && status !== 'skipped') return false;
    session.setItem(ONBOARDING_SAVE_FAILURES_KEY, String(left - 1));
    return true;
  } catch {
    return false;
  }
}

export async function saveOnboardingStateSnapshot(
  actorScope: string,
  serializedState: string
): Promise<void> {
  if (refusesOnboardingSave(serializedState)) throw new Error('Mock storage refused the onboarding write');
  await setMockItem(scopedStorageKey(storageKeys.onboardingState, actorScope), serializedState);
}

export async function getOnboardingGuestClaimedBy(): Promise<string | null> {
  const saved = await getMockItem(storageKeys.onboardingGuestClaimedBy);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as unknown;
    return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveOnboardingGuestClaimedBy(userId: string): Promise<void> {
  await setMockItem(storageKeys.onboardingGuestClaimedBy, JSON.stringify(userId));
}

export async function getPendingRecordingNotification(): Promise<'/recording' | null> {
  const serialized = mockStorage[storageKeys.pendingRecordingNotification];
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (parsed === '/recording') return parsed;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'url' in parsed &&
      (parsed as { url?: unknown }).url === '/recording'
    ) {
      return '/recording';
    }
  } catch {
    // Ignore corrupted test state.
  }
  return null;
}

export async function savePendingRecordingNotification(url: '/recording'): Promise<void> {
  mockStorage[storageKeys.pendingRecordingNotification] = JSON.stringify({
    url,
    queuedAt: Date.now(),
  });
}

export async function clearPendingRecordingNotification(): Promise<void> {
  delete mockStorage[storageKeys.pendingRecordingNotification];
}

export async function getPendingAuthReturn(): Promise<string | null> {
  return mockStorage[storageKeys.authReturn] ?? null;
}

export async function savePendingAuthReturn(serialized: string): Promise<void> {
  mockStorage[storageKeys.authReturn] = serialized;
}

export async function getDreamsMigrationSynced(userId: string): Promise<boolean> {
  if (!userId) return false;
  const key = `${storageKeys.dreamsMigrationSyncedPrefix}${userId}`;
  return mockStorage[key] === 'true';
}

export async function setDreamsMigrationSynced(userId: string, synced: boolean): Promise<void> {
  if (!userId) return;
  const key = `${storageKeys.dreamsMigrationSyncedPrefix}${userId}`;
  mockStorage[key] = synced ? 'true' : 'false';
}

export async function getGuestDreamMigrationOwner(): Promise<GuestDreamMigrationOwner | null> {
  const raw = mockStorage[storageKeys.guestDreamMigrationOwner];
  return raw ? JSON.parse(raw) as GuestDreamMigrationOwner : null;
}

export async function setGuestDreamMigrationOwner(owner: GuestDreamMigrationOwner | null): Promise<void> {
  mockStorage[storageKeys.guestDreamMigrationOwner] = owner ? JSON.stringify(owner) : '';
}

export async function getCachedRemoteDreams(
  userScope?: string | null
): Promise<DreamListReadResult> {
  console.log('[MOCK STORAGE] getCachedRemoteDreams called');
  try {
    const scopedKey = scopedStorageKey(storageKeys.remoteDreamsCache, userScope);
    const cached = mockStorage[scopedKey];
    if (cached !== undefined) {
      const parsed = JSON.parse(cached) as unknown;
      return Array.isArray(parsed)
        ? { status: 'loaded', value: parsed as DreamAnalysis[] }
        : { status: 'error' };
    }
  } catch {
    console.error('[MOCK STORAGE] Failed to read cached remote dreams');
    return { status: 'error' };
  }
  return { status: 'absent' };
}

export async function saveCachedRemoteDreams(
  dreams: DreamAnalysis[],
  userScope?: string | null
): Promise<void> {
  console.log('[MOCK STORAGE] saveCachedRemoteDreams called with', dreams.length, 'dreams');
  try {
    mockStorage[scopedStorageKey(storageKeys.remoteDreamsCache, userScope)] = JSON.stringify(dreams);
    if (userScope) {
      delete mockStorage[storageKeys.remoteDreamsCache];
    }
  } catch {
    console.error('[MOCK STORAGE] Failed to cache remote dreams');
    throw new Error('Failed to cache remote dreams');
  }
}

export async function clearRemoteDreamStorage(userScope?: string | null): Promise<void> {
  try {
    const scopedMutations = parsePendingDreamMutationsPayload(
      mockStorage[scopedStorageKey(storageKeys.dreamMutations, userScope)],
      userScope
    );
    const legacyMutations =
      userScope != null
        ? parsePendingDreamMutationsPayload(mockStorage[storageKeys.dreamMutations], userScope)
        : [];
    const deduped = new Map<string, DreamMutation>();
    for (const mutation of scopedMutations) {
      deduped.set(mutation.id, mutation);
    }
    for (const mutation of legacyMutations) {
      deduped.set(mutation.id, mutation);
    }
    if (deduped.size > 0) {
      reportSyncQueueClearedWithPending({
        mutations: Array.from(deduped.values()),
        reason: 'clear_remote_dream_storage_mock',
        userScope,
      });
    }
  } catch {
    console.error('[MOCK STORAGE] Failed to inspect pending mutations before clearing');
  }

  delete mockStorage[scopedStorageKey(storageKeys.remoteDreamsCache, userScope)];
  delete mockStorage[scopedStorageKey(storageKeys.dreamMutations, userScope)];
  if (userScope) {
    delete mockStorage[storageKeys.remoteDreamsCache];
    delete mockStorage[storageKeys.dreamMutations];
  }
}

export async function getPendingDreamMutations(userScope?: string | null): Promise<DreamMutation[]> {
  console.log('[MOCK STORAGE] getPendingDreamMutations called');
  try {
    const scopedKey = scopedStorageKey(storageKeys.dreamMutations, userScope);
    return parsePendingDreamMutationsPayload(mockStorage[scopedKey], userScope);
  } catch {
    console.error('[MOCK STORAGE] Failed to read pending dream mutations');
    throw new Error('Failed to read pending dream mutations');
  }
}

export async function savePendingDreamMutations(
  mutations: DreamMutation[],
  userScope?: string | null
): Promise<void> {
  console.log('[MOCK STORAGE] savePendingDreamMutations called with', mutations.length, 'mutations');
  try {
    const effectiveUserScope = userScope || 'user:unknown';
    const normalized = mutations.map((mutation) =>
      mutation.version === 1
        ? mutation
        : migrateLegacyDreamMutation(mutation as unknown as Record<string, unknown>, effectiveUserScope) ?? mutation
    );
    mockStorage[scopedStorageKey(storageKeys.dreamMutations, userScope)] = JSON.stringify(normalized);
    if (userScope) {
      delete mockStorage[storageKeys.dreamMutations];
    }
  } catch {
    console.error('[MOCK STORAGE] Failed to save pending dream mutations');
    throw new Error('Failed to save pending dream mutations');
  }
}

export async function getPendingImageJobs(): Promise<PendingImageJob[]> {
  console.log('[MOCK STORAGE] getPendingImageJobs called');
  try {
    const pending = mockStorage[storageKeys.imageJobs];
    if (pending) {
      return JSON.parse(pending) as PendingImageJob[];
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to read pending image jobs:', error);
  }
  return [];
}

export async function savePendingImageJobs(jobs: PendingImageJob[]): Promise<void> {
  console.log('[MOCK STORAGE] savePendingImageJobs called with', jobs.length, 'jobs');
  try {
    mockStorage[storageKeys.imageJobs] = JSON.stringify(jobs);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save pending image jobs:', error);
    throw new Error('Failed to save pending image jobs');
  }
}

/**
 * Utility function to reset mock storage (useful for testing)
 */
export function resetMockStorage(): void {
  console.log('[MOCK STORAGE] Resetting all mock storage');
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  dreamsPreloaded = false;
}

/** Clear only the persisted dogfood namespace; real app storage is untouched. */
export async function clearMockDogfoodStorage(): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const keys = (await AsyncStorage.getAllKeys())
    .filter(key => key.startsWith(MOCK_DOGFOOD_STORAGE_PREFIX));
  if (keys.length > 0) {
    await AsyncStorage.multiRemove(keys);
  }
}
