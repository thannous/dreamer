/**
 * Mock implementation of storageService for development mode
 * Uses in-memory storage with predefined dreams pre-loaded
 */

import type { DreamAnalysis, LanguagePreference, NotificationSettings, ThemePreference } from '@/lib/types';
import { getPredefinedDreamsWithTimestamps } from '@/mock-data/predefinedDreams';

// In-memory storage
const mockStorage: Record<string, string> = {};

// Flag to track if we've pre-loaded dreams
let dreamsPreloaded = false;

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  isEnabled: false,
  weekdayTime: '07:00',
  weekendTime: '10:00',
};

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'auto';
const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'auto';

/**
 * Pre-load predefined dreams on first access
 */
function ensureDreamsPreloaded(): void {
  if (dreamsPreloaded) return;

  console.log('[MOCK STORAGE] Pre-loading predefined dreams...');
  const predefinedDreams = getPredefinedDreamsWithTimestamps();
  mockStorage['gemini_dream_journal_dreams'] = JSON.stringify(predefinedDreams);
  dreamsPreloaded = true;
  console.log(`[MOCK STORAGE] Loaded ${predefinedDreams.length} predefined dreams`);
}

/**
 * Mock get saved dreams
 * Returns predefined dreams on first load, then returns saved state
 */
export async function getSavedDreams(): Promise<DreamAnalysis[]> {
  console.log('[MOCK STORAGE] getSavedDreams called');
  ensureDreamsPreloaded();

  try {
    const savedDreams = mockStorage['gemini_dream_journal_dreams'];
    if (savedDreams) {
      const dreams = JSON.parse(savedDreams) as DreamAnalysis[];
      const sorted = dreams.sort((a, b) => b.id - a.id);
      console.log(`[MOCK STORAGE] Returning ${sorted.length} dreams`);
      return sorted;
    }
    return [];
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve dreams:', error);
    return [];
  }
}

/**
 * Mock save dreams
 */
export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  console.log(`[MOCK STORAGE] saveDreams called with ${dreams.length} dreams`);
  try {
    mockStorage['gemini_dream_journal_dreams'] = JSON.stringify(dreams);
    console.log('[MOCK STORAGE] Dreams saved successfully');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save dreams:', error);
    throw new Error('Failed to persist dreams to storage');
  }
}

/**
 * Mock get saved transcript
 */
export async function getSavedTranscript(): Promise<string> {
  console.log('[MOCK STORAGE] getSavedTranscript called');
  try {
    return mockStorage['gemini_dream_journal_recording_transcript'] || '';
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve transcript:', error);
    return '';
  }
}

/**
 * Mock save transcript
 */
export async function saveTranscript(transcript: string): Promise<void> {
  console.log('[MOCK STORAGE] saveTranscript called with:', transcript.slice(0, 50) + '...');
  try {
    if (transcript) {
      mockStorage['gemini_dream_journal_recording_transcript'] = transcript;
    } else {
      delete mockStorage['gemini_dream_journal_recording_transcript'];
    }
    console.log('[MOCK STORAGE] Transcript saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save transcript:', error);
    throw new Error('Failed to save transcript');
  }
}

/**
 * Mock clear saved transcript
 */
export async function clearSavedTranscript(): Promise<void> {
  console.log('[MOCK STORAGE] clearSavedTranscript called');
  try {
    delete mockStorage['gemini_dream_journal_recording_transcript'];
    console.log('[MOCK STORAGE] Transcript cleared');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to clear transcript:', error);
  }
}

/**
 * Mock get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  console.log('[MOCK STORAGE] getNotificationSettings called');
  try {
    const savedSettings = mockStorage['gemini_dream_journal_notification_settings'];
    if (savedSettings) {
      const settings = JSON.parse(savedSettings) as NotificationSettings;
      console.log('[MOCK STORAGE] Returning saved notification settings');
      return settings;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve notification settings:', error);
  }
  console.log('[MOCK STORAGE] Returning default notification settings');
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * Mock save notification settings
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  console.log('[MOCK STORAGE] saveNotificationSettings called:', settings);
  try {
    mockStorage['gemini_dream_journal_notification_settings'] = JSON.stringify(settings);
    console.log('[MOCK STORAGE] Notification settings saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save notification settings:', error);
    throw new Error('Failed to save notification settings');
  }
}

/**
 * Mock get theme preference
 */
export async function getThemePreference(): Promise<ThemePreference> {
  console.log('[MOCK STORAGE] getThemePreference called');
  try {
    const savedPreference = mockStorage['gemini_dream_journal_theme_preference'];
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

/**
 * Mock save theme preference
 */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveThemePreference called:', preference);
  try {
    mockStorage['gemini_dream_journal_theme_preference'] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Theme preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save theme preference:', error);
    throw new Error('Failed to save theme preference');
  }
}

/**
 * Mock get language preference
 */
export async function getLanguagePreference(): Promise<LanguagePreference> {
  console.log('[MOCK STORAGE] getLanguagePreference called');
  try {
    const savedPreference = mockStorage['gemini_dream_journal_language_preference'];
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

/**
 * Mock save language preference
 */
export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveLanguagePreference called:', preference);
  try {
    mockStorage['gemini_dream_journal_language_preference'] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Language preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save language preference:', error);
    throw new Error('Failed to save language preference');
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
