import type { DreamAnalysis, NotificationSettings } from '@/lib/types';

const DREAMS_STORAGE_KEY = 'gemini_dream_journal_dreams';
const RECORDING_TRANSCRIPT_KEY = 'gemini_dream_journal_recording_transcript';
const NOTIFICATION_SETTINGS_KEY = 'gemini_dream_journal_notification_settings';

// In-memory fallback if AsyncStorage is not installed yet
const memoryStore: Record<string, string> = {};
let AsyncStorageRef: any | null = null;

async function getAsyncStorage(): Promise<any | null> {
  if (AsyncStorageRef) return AsyncStorageRef;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    AsyncStorageRef = (mod as any)?.default ?? mod;
  } catch {
    AsyncStorageRef = null;
  }
  return AsyncStorageRef;
}

async function getItem(key: string): Promise<string | null> {
  const AS = await getAsyncStorage();
  if (AS) return AS.getItem(key);
  return memoryStore[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  const AS = await getAsyncStorage();
  if (AS) return AS.setItem(key, value);
  memoryStore[key] = value;
}

async function removeItem(key: string): Promise<void> {
  const AS = await getAsyncStorage();
  if (AS) return AS.removeItem(key);
  delete memoryStore[key];
}

export async function getSavedDreams(): Promise<DreamAnalysis[]> {
  try {
    const savedDreams = await getItem(DREAMS_STORAGE_KEY);
    if (savedDreams) {
      const dreams = JSON.parse(savedDreams) as DreamAnalysis[];
      return dreams.sort((a, b) => b.id - a.id);
    }
    return [];
  } catch (error) {
    console.error('Failed to retrieve dreams:', error);
    return [];
  }
}

export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  try {
    await setItem(DREAMS_STORAGE_KEY, JSON.stringify(dreams));
  } catch (error) {
    console.error('Failed to save dreams:', error);
  }
}

export async function getSavedTranscript(): Promise<string> {
  try {
    return (await getItem(RECORDING_TRANSCRIPT_KEY)) || '';
  } catch (error) {
    console.error('Failed to retrieve transcript:', error);
    return '';
  }
}

export async function saveTranscript(transcript: string): Promise<void> {
  try {
    if (transcript) {
      await setItem(RECORDING_TRANSCRIPT_KEY, transcript);
    } else {
      await removeItem(RECORDING_TRANSCRIPT_KEY);
    }
  } catch (error) {
    console.error('Failed to save transcript:', error);
  }
}

export async function clearSavedTranscript(): Promise<void> {
  try {
    await removeItem(RECORDING_TRANSCRIPT_KEY);
  } catch (error) {
    console.error('Failed to clear transcript:', error);
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const savedSettings = await getItem(NOTIFICATION_SETTINGS_KEY);
    if (savedSettings) return JSON.parse(savedSettings) as NotificationSettings;
  } catch (error) {
    console.error('Failed to retrieve notification settings:', error);
  }
  return { isEnabled: false, weekdayTime: '07:00', weekendTime: '10:00' };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save notification settings:', error);
  }
}

