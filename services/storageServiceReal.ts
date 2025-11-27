import { Platform } from 'react-native';

import type {
  DreamAnalysis,
  DreamMutation,
  LanguagePreference,
  NotificationSettings,
  RitualStepProgress,
  ThemePreference,
} from '@/lib/types';

const DREAMS_STORAGE_KEY = 'gemini_dream_journal_dreams';
const REMOTE_DREAMS_CACHE_KEY = 'gemini_dream_journal_remote_dreams_cache';
const DREAM_MUTATIONS_KEY = 'gemini_dream_journal_pending_mutations';
const RECORDING_TRANSCRIPT_KEY = 'gemini_dream_journal_recording_transcript';
const NOTIFICATION_SETTINGS_KEY = 'gemini_dream_journal_notification_settings';
const THEME_PREFERENCE_KEY = 'gemini_dream_journal_theme_preference';
const LANGUAGE_PREFERENCE_KEY = 'gemini_dream_journal_language_preference';
const RITUAL_PREFERENCE_KEY = 'gemini_dream_journal_ritual_preference';
const RITUAL_PROGRESS_KEY = 'gemini_dream_journal_ritual_progress';
const FIRST_LAUNCH_COMPLETED_KEY = 'gemini_dream_journal_first_launch_completed';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type AsyncStorageModule = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type IndexedDBStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// In-memory fallback if AsyncStorage is not installed yet
const memoryStore: Record<string, string> = {};
let AsyncStorageRef: AsyncStorageModule | null | undefined;
let indexedDBStorage: IndexedDBStorage | null | undefined;

const IDB_DB_NAME = 'gemini_dream_journal';
const IDB_STORE_NAME = 'storage';
const IDB_VERSION = 1;

async function createIndexedDBStorage(): Promise<IndexedDBStorage> {
  const globalWithIDB = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
  const factory = globalWithIDB.indexedDB;
  if (!factory) {
    throw new Error('IndexedDB not available');
  }

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(IDB_DB_NAME, IDB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE_NAME)) {
        database.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB upgrade blocked by another connection'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });

  db.onversionchange = () => {
    db.close();
    indexedDBStorage = undefined;
  };

  const run = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      let request: IDBRequest<T>;
      try {
        const tx = db.transaction(IDB_STORE_NAME, mode);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
        const store = tx.objectStore(IDB_STORE_NAME);
        request = operation(store);
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB request failed'));
        };
        tx.oncomplete = () => {
          resolve(request.result);
        };
      } catch (error) {
        reject(error as Error);
      }
    });

  return {
    async getItem(key: string): Promise<string | null> {
      const result = await run<string | undefined>('readonly', (store) => store.get(key));
      return typeof result === 'string' ? result : null;
    },

    async setItem(key: string, value: string): Promise<void> {
      await run<IDBValidKey>('readwrite', (store) => store.put(value, key));
    },

    async removeItem(key: string): Promise<void> {
      await run<undefined>('readwrite', (store) => store.delete(key));
    },
  };
}

async function getIndexedDBStorage(): Promise<IndexedDBStorage | null> {
  if (indexedDBStorage !== undefined) {
    return indexedDBStorage;
  }

  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') {
    indexedDBStorage = null;
    return indexedDBStorage;
  }

  try {
    indexedDBStorage = await createIndexedDBStorage();
  } catch (error) {
    if (__DEV__) {
      console.warn('IndexedDB unavailable, falling back to localStorage:', error);
    }
    indexedDBStorage = null;
  }

  return indexedDBStorage;
}

const webStorage: StorageLike | null =
  Platform.OS === 'web' && typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? ((globalThis as unknown as { localStorage?: StorageLike }).localStorage ?? null)
    : null;

async function getAsyncStorage(): Promise<AsyncStorageModule | null> {
  // The web implementation of AsyncStorage is a thin wrapper around localStorage,
  // which does not have enough quota for storing dream images. Force the web
  // platform to use the IndexedDB pathway instead so we can persist large payloads.
  if (Platform.OS === 'web') {
    AsyncStorageRef = null;
    return AsyncStorageRef;
  }

  if (AsyncStorageRef !== undefined) return AsyncStorageRef;
  try {
    const mod = require('@react-native-async-storage/async-storage') as
      | AsyncStorageModule
      | { default: AsyncStorageModule };
    AsyncStorageRef = 'default' in mod ? mod.default : mod;
  } catch {
    AsyncStorageRef = null;
  }
  return AsyncStorageRef;
}

async function getItem(key: string): Promise<string | null> {
  const AS = await getAsyncStorage();
  if (AS) return AS.getItem(key);
  const idb = await getIndexedDBStorage();
  if (idb) {
    const value = await idb.getItem(key);
    if (value != null) {
      return value;
    }

    if (webStorage) {
      const legacyValue = webStorage.getItem(key);
      if (legacyValue != null) {
        try {
          await idb.setItem(key, legacyValue);
          webStorage.removeItem(key);
        } catch (migrationError) {
          if (__DEV__) {
            console.warn('Failed to migrate localStorage value to IndexedDB', migrationError);
          }
        }
        return legacyValue;
      }
    }
    return null;
  }
  if (webStorage) return webStorage.getItem(key);
  return memoryStore[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  const AS = await getAsyncStorage();
  if (AS) return AS.setItem(key, value);
  const idb = await getIndexedDBStorage();
  if (idb) {
    await idb.setItem(key, value);
    return;
  }
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }
  memoryStore[key] = value;
}

async function removeItem(key: string): Promise<void> {
  const AS = await getAsyncStorage();
  if (AS) return AS.removeItem(key);
  const idb = await getIndexedDBStorage();
  if (idb) {
    await idb.removeItem(key);
    return;
  }
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }
  delete memoryStore[key];
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  isEnabled: false,
  weekdayTime: '07:00',
  weekendTime: '10:00',
};

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'auto';

const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'auto';

export async function getSavedDreams(): Promise<DreamAnalysis[]> {
  try {
    const savedDreams = await getItem(DREAMS_STORAGE_KEY);
    if (savedDreams) {
      const dreams = JSON.parse(savedDreams) as DreamAnalysis[];
      return dreams.sort((a, b) => b.id - a.id);
    }
    return [];
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve dreams:', error);
    }
    return [];
  }
}

export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  try {
    await setItem(DREAMS_STORAGE_KEY, JSON.stringify(dreams));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save dreams:', error);
    }
    throw new Error('Failed to persist dreams to storage');
  }
}

export async function getSavedTranscript(): Promise<string> {
  try {
    return (await getItem(RECORDING_TRANSCRIPT_KEY)) || '';
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve transcript:', error);
    }
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
    if (__DEV__) {
      console.error('Failed to save transcript:', error);
    }
    throw new Error('Failed to save transcript');
  }
}

export async function clearSavedTranscript(): Promise<void> {
  try {
    await removeItem(RECORDING_TRANSCRIPT_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear transcript:', error);
    }
    // Non-critical operation, don't throw
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const savedSettings = await getItem(NOTIFICATION_SETTINGS_KEY);
    if (savedSettings) {
      return JSON.parse(savedSettings) as NotificationSettings;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve notification settings:', error);
    }
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save notification settings:', error);
    }
    throw new Error('Failed to save notification settings');
  }
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const savedPreference = await getItem(THEME_PREFERENCE_KEY);
    if (savedPreference) {
      return JSON.parse(savedPreference) as ThemePreference;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve theme preference:', error);
    }
  }
  return DEFAULT_THEME_PREFERENCE;
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await setItem(THEME_PREFERENCE_KEY, JSON.stringify(preference));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save theme preference:', error);
    }
    throw new Error('Failed to save theme preference');
  }
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const savedPreference = await getItem(LANGUAGE_PREFERENCE_KEY);
    if (savedPreference) {
      return JSON.parse(savedPreference) as LanguagePreference;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve language preference:', error);
    }
  }
  return DEFAULT_LANGUAGE_PREFERENCE;
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  try {
    await setItem(LANGUAGE_PREFERENCE_KEY, JSON.stringify(preference));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save language preference:', error);
    }
    throw new Error('Failed to save language preference');
  }
}

export async function getRitualPreference(): Promise<string | null> {
  try {
    const savedPreference = await getItem(RITUAL_PREFERENCE_KEY);
    if (savedPreference) {
      return JSON.parse(savedPreference) as string;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve ritual preference:', error);
    }
  }
  return null;
}

export async function saveRitualPreference(preference: string): Promise<void> {
  try {
    await setItem(RITUAL_PREFERENCE_KEY, JSON.stringify(preference));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save ritual preference:', error);
    }
    throw new Error('Failed to save ritual preference');
  }
}

export async function getRitualStepProgress(): Promise<RitualStepProgress | null> {
  try {
    const savedProgress = await getItem(RITUAL_PROGRESS_KEY);
    if (savedProgress) {
      return JSON.parse(savedProgress) as RitualStepProgress;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve ritual step progress:', error);
    }
  }
  return null;
}

export async function saveRitualStepProgress(progress: RitualStepProgress): Promise<void> {
  try {
    await setItem(RITUAL_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save ritual step progress:', error);
    }
    throw new Error('Failed to save ritual step progress');
  }
}

export async function getFirstLaunchCompleted(): Promise<boolean> {
  try {
    const savedFlag = await getItem(FIRST_LAUNCH_COMPLETED_KEY);
    if (savedFlag) {
      return JSON.parse(savedFlag) as boolean;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve first launch flag:', error);
    }
  }
  return false;
}

export async function saveFirstLaunchCompleted(completed: boolean): Promise<void> {
  try {
    await setItem(FIRST_LAUNCH_COMPLETED_KEY, JSON.stringify(completed));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save first launch flag:', error);
    }
    throw new Error('Failed to save first launch flag');
  }
}

export async function getCachedRemoteDreams(): Promise<DreamAnalysis[]> {
  try {
    const cachedDreams = await getItem(REMOTE_DREAMS_CACHE_KEY);
    if (cachedDreams) {
      return JSON.parse(cachedDreams) as DreamAnalysis[];
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to read cached remote dreams:', error);
    }
  }
  return [];
}

export async function saveCachedRemoteDreams(dreams: DreamAnalysis[]): Promise<void> {
  try {
    await setItem(REMOTE_DREAMS_CACHE_KEY, JSON.stringify(dreams));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to cache remote dreams:', error);
    }
    throw new Error('Failed to cache remote dreams');
  }
}

export async function getPendingDreamMutations(): Promise<DreamMutation[]> {
  try {
    const pending = await getItem(DREAM_MUTATIONS_KEY);
    if (pending) {
      return JSON.parse(pending) as DreamMutation[];
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to read pending dream mutations:', error);
    }
  }
  return [];
}

export async function savePendingDreamMutations(mutations: DreamMutation[]): Promise<void> {
  try {
    await setItem(DREAM_MUTATIONS_KEY, JSON.stringify(mutations));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save pending dream mutations:', error);
    }
    throw new Error('Failed to save pending dream mutations');
  }
}
