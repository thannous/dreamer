import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
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
const DREAMS_MIGRATION_SYNCED_PREFIX = 'gemini_dream_journal_dreams_migration_synced_';
const MAX_CHAT_HISTORY_FOR_STORAGE = 50;
const IMAGE_CACHE_DIR = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory ?? null;
// Store large payloads on the filesystem to avoid Android CursorWindow limits in AsyncStorage
const FILE_STORAGE_DIR = FileSystemLegacy.documentDirectory ?? FileSystemLegacy.cacheDirectory ?? null;
const FILE_STORAGE_PREFIX = FILE_STORAGE_DIR ? `${FILE_STORAGE_DIR}storage/` : null;
const FILE_BACKED_KEYS = new Set([
  DREAMS_STORAGE_KEY,
  REMOTE_DREAMS_CACHE_KEY,
  DREAM_MUTATIONS_KEY,
]);

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
let SQLiteKvStoreRef: AsyncStorageModule | null | undefined;
let indexedDBStorage: IndexedDBStorage | null | undefined;
// Serialize kv-store access to avoid SQLite "database is locked" errors.
let kvLock: Promise<void> = Promise.resolve();

const KV_RETRY_LIMIT = 2;
const KV_RETRY_DELAY_MS = 60;

const extractErrorText = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText =
      typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : '';
    return `${error.message} ${causeText}`.trim();
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
};

const isSQLiteBusyError = (error: unknown): boolean => {
  const text = extractErrorText(error).toLowerCase();
  if (text.includes('database is locked') || text.includes('sqlite_busy')) {
    return true;
  }
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.toLowerCase().includes('sqlite')) {
      return true;
    }
  }
  return false;
};

const IDB_DB_NAME = 'gemini_dream_journal';
const IDB_STORE_NAME = 'storage';
const IDB_VERSION = 1;

const getFileBackedPath = (key: string): string | null =>
  FILE_STORAGE_PREFIX ? `${FILE_STORAGE_PREFIX}${key}.json` : null;

const shouldUseFileStorage = (key: string): boolean =>
  Platform.OS !== 'web' && FILE_BACKED_KEYS.has(key) && Boolean(FILE_STORAGE_PREFIX);

async function readFileBackedItem(key: string): Promise<string | null> {
  const path = getFileBackedPath(key);
  if (!path) return null;
  try {
    const info = await FileSystemLegacy.getInfoAsync(path);
    if (!info.exists || info.isDirectory) return null;
    const file = new FileSystem.File(path);
    return await file.text();
  } catch (error) {
    if (__DEV__) {
      console.warn(`Failed to read file-backed key ${key}`, error);
    }
    return null;
  }
}

async function writeFileBackedItem(key: string, value: string): Promise<void> {
  const path = getFileBackedPath(key);
  if (!path) {
    throw new Error('File storage unavailable');
  }
  try {
    await FileSystemLegacy.makeDirectoryAsync(FILE_STORAGE_PREFIX!, { intermediates: true });
    const file = new FileSystem.File(path);
    file.write(value, { encoding: 'utf8' });
  } catch (error) {
    if (__DEV__) {
      console.warn(`Failed to write file-backed key ${key}`, error);
    }
    throw error;
  }
}

async function deleteFileBackedItem(key: string): Promise<void> {
  const path = getFileBackedPath(key);
  if (!path) return;
  try {
    await FileSystemLegacy.deleteAsync(path, { idempotent: true });
  } catch (error) {
    if (__DEV__) {
      console.warn(`Failed to delete file-backed key ${key}`, error);
    }
  }
}

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

async function getLegacyAsyncStorage(): Promise<AsyncStorageModule | null> {
  // The web implementation of AsyncStorage is a thin wrapper around localStorage,
  // which does not have enough quota for storing dream images. Force the web
  // platform to use the IndexedDB pathway instead so we can persist large payloads.
  if (Platform.OS === 'web') {
    AsyncStorageRef = null;
    return AsyncStorageRef;
  }

  if (AsyncStorageRef !== undefined) return AsyncStorageRef;
  try {
    const mod = (await import('@react-native-async-storage/async-storage')) as
      | AsyncStorageModule
      | { default: AsyncStorageModule };
    AsyncStorageRef = 'default' in mod ? mod.default : mod;
  } catch {
    AsyncStorageRef = null;
  }
  return AsyncStorageRef;
}

async function getSQLiteKvStore(): Promise<AsyncStorageModule | null> {
  // Web support for expo-sqlite requires additional WASM + COOP/COEP setup; keep the
  // existing IndexedDB/localStorage pathway on web to avoid bundling issues.
  if (Platform.OS === 'web') {
    SQLiteKvStoreRef = null;
    return SQLiteKvStoreRef;
  }

  if (SQLiteKvStoreRef !== undefined) return SQLiteKvStoreRef;
  try {
    const mod = (await import('expo-sqlite/kv-store')) as AsyncStorageModule | { default: AsyncStorageModule };
    SQLiteKvStoreRef = 'default' in mod ? mod.default : mod;
  } catch {
    SQLiteKvStoreRef = null;
  }
  return SQLiteKvStoreRef;
}

async function withKvLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = kvLock.then(operation, operation);
  kvLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function withKvRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= KV_RETRY_LIMIT; attempt += 1) {
    try {
      return await withKvLock(operation);
    } catch (error) {
      if (!isSQLiteBusyError(error) || attempt === KV_RETRY_LIMIT) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, KV_RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw new Error('KV retry exhausted');
}

async function getItem(key: string): Promise<string | null> {
  const kv = await getSQLiteKvStore();
  const legacyAS = await getLegacyAsyncStorage();

  if (Platform.OS !== 'web' && FILE_BACKED_KEYS.has(key) && kv) {
    const start = Date.now();
    try {
      const value = await withKvRetry(() => kv.getItem(key));
      if (value != null) {
        if (__DEV__) {
          logger.debug('[storageServiceReal] kv-store hit', {
            key,
            bytes: value.length,
            ms: Date.now() - start,
          });
        }
        return value;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`Failed to read kv-store key ${key}`, error);
      }
    }

    const fileValue = await readFileBackedItem(key);
    if (fileValue != null) {
      await withKvRetry(() => kv.setItem(key, fileValue));
      await deleteFileBackedItem(key);
      if (legacyAS) {
        try {
          await legacyAS.removeItem(key);
        } catch {
          // Best-effort cleanup
        }
      }
      if (__DEV__) {
        logger.debug('[storageServiceReal] migrated file-backed key to kv-store', {
          key,
          bytes: fileValue.length,
        });
      }
      return fileValue;
    }

    if (legacyAS) {
      try {
        const legacyValue = await legacyAS.getItem(key);
        if (legacyValue != null) {
          await withKvRetry(() => kv.setItem(key, legacyValue));
          try {
            await legacyAS.removeItem(key);
          } catch {
            // Best-effort cleanup
          }
          if (__DEV__) {
            logger.debug('[storageServiceReal] migrated AsyncStorage key to kv-store', {
              key,
              bytes: legacyValue.length,
            });
          }
          return legacyValue;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`Failed to read legacy AsyncStorage key ${key}`, error);
        }
        if (error instanceof Error && error.message.includes('Row too big')) {
          try {
            await legacyAS.removeItem(key);
          } catch {
            // Best-effort cleanup
          }
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  if (shouldUseFileStorage(key)) {
    const fileValue = await readFileBackedItem(key);
    if (fileValue != null) {
      return fileValue;
    }
  }

  if (kv) {
    try {
      const value = await withKvRetry(() => kv.getItem(key));
      if (value != null) return value;
    } catch (error) {
      if (__DEV__) {
        console.warn(`Failed to read kv-store key ${key}`, error);
      }
    }

    if (legacyAS) {
      try {
        const legacyValue = await legacyAS.getItem(key);
        if (legacyValue != null) {
          await withKvRetry(() => kv.setItem(key, legacyValue));
          try {
            await legacyAS.removeItem(key);
          } catch {
            // Best-effort cleanup
          }
          return legacyValue;
        }
      } catch {
        // Ignore legacy read failures; caller can fall back to other stores.
      }
    }
  }

  if (legacyAS) {
    try {
      const value = await legacyAS.getItem(key);
      if (value != null && shouldUseFileStorage(key)) {
        await writeFileBackedItem(key, value);
        await legacyAS.removeItem(key);
      }
      return value;
    } catch (error) {
      if (__DEV__) {
        console.warn(`Failed to read AsyncStorage key ${key}`, error);
      }
      if (error instanceof Error && error.message.includes('Row too big')) {
        try {
          await legacyAS.removeItem(key);
        } catch {
          // Best-effort cleanup
        }
      } else {
        throw error;
      }
    }
  }
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
  const kv = await getSQLiteKvStore();
  const legacyAS = await getLegacyAsyncStorage();

  if (Platform.OS !== 'web' && FILE_BACKED_KEYS.has(key) && kv) {
    const start = Date.now();
    try {
      await withKvRetry(() => kv.setItem(key, value));
      await deleteFileBackedItem(key);
      if (legacyAS) {
        try {
          await legacyAS.removeItem(key);
        } catch {
          // Best-effort cleanup
        }
      }
      if (__DEV__) {
        logger.debug('[storageServiceReal] kv-store write', {
          key,
          bytes: value.length,
          ms: Date.now() - start,
        });
      }
      return;
    } catch (error) {
      if (isSQLiteBusyError(error) && shouldUseFileStorage(key)) {
        await writeFileBackedItem(key, value);
        if (__DEV__) {
          logger.warn('[storageServiceReal] kv-store busy; wrote file-backed value', { key });
        }
        return;
      }
      throw error;
    }
  }

  if (shouldUseFileStorage(key)) {
    await writeFileBackedItem(key, value);
    if (legacyAS) {
      try {
        await legacyAS.removeItem(key);
      } catch {
        // Swallow cleanup errors
      }
    }
    return;
  }

  if (kv) {
    try {
      await withKvRetry(() => kv.setItem(key, value));
      if (legacyAS) {
        try {
          await legacyAS.removeItem(key);
        } catch {
          // Best-effort cleanup
        }
      }
      return;
    } catch (error) {
      if (isSQLiteBusyError(error) && legacyAS) {
        await legacyAS.setItem(key, value);
        return;
      }
      throw error;
    }
  }

  if (legacyAS) return legacyAS.setItem(key, value);
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
  if (shouldUseFileStorage(key)) {
    await deleteFileBackedItem(key);
  }

  const kv = await getSQLiteKvStore();
  const legacyAS = await getLegacyAsyncStorage();

  if (kv) {
    try {
      await withKvRetry(() => kv.removeItem(key));
    } catch {
      // Best-effort cleanup
    }
  }

  if (legacyAS) {
    try {
      await legacyAS.removeItem(key);
    } catch {
      // Best-effort cleanup
    }
  }

  if (kv || legacyAS) return;
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

const isDataUriImage = (value?: string | null): value is string =>
  Boolean(value && value.startsWith('data:image'));

const extractBase64Payload = (value: string): string | null => {
  const separatorIndex = value.indexOf(',');
  if (separatorIndex === -1) return null;
  return value.slice(separatorIndex + 1);
};

async function persistDataUriImage(imageUrl: string, dreamId: number): Promise<string | null> {
  if (!IMAGE_CACHE_DIR) return null;
  const base64 = extractBase64Payload(imageUrl);
  if (!base64) return null;

  const extMatch = /^data:image\/(.+);base64/.exec(imageUrl);
  const extension = (extMatch?.[1] ?? 'jpg').split('+')[0];
  const dir = `${IMAGE_CACHE_DIR}dream-images/`;
  const filePath = `${dir}${dreamId}.${extension}`;

  try {
    await FileSystemLegacy.makeDirectoryAsync(dir, { intermediates: true });
    const file = new FileSystem.File(filePath);
    file.write(base64, { encoding: 'base64' });
    return filePath;
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to persist inline image, dropping to save space', error);
    }
    return null;
  }
}

async function normalizeDreamForStorage(dream: DreamAnalysis): Promise<DreamAnalysis> {
  const trimmedChatHistory = Array.isArray(dream.chatHistory)
    ? dream.chatHistory.slice(-MAX_CHAT_HISTORY_FOR_STORAGE)
    : [];

  let imageUrl = dream.imageUrl;
  let thumbnailUrl = dream.thumbnailUrl;

  if (isDataUriImage(imageUrl)) {
    const persisted = await persistDataUriImage(imageUrl, dream.id);
    imageUrl = persisted ?? '';
    if (!thumbnailUrl || isDataUriImage(thumbnailUrl)) {
      thumbnailUrl = persisted ?? undefined;
    }
  } else if (thumbnailUrl && isDataUriImage(thumbnailUrl)) {
    const persisted = await persistDataUriImage(thumbnailUrl, dream.id);
    thumbnailUrl = persisted ?? undefined;
  }

  return {
    ...dream,
    imageUrl,
    thumbnailUrl,
    chatHistory: trimmedChatHistory,
  };
}

async function normalizeDreamsForStorage(dreams: DreamAnalysis[]): Promise<DreamAnalysis[]> {
  return Promise.all(dreams.map((dream) => normalizeDreamForStorage(dream)));
}

async function normalizeMutationsForStorage(mutations: DreamMutation[]): Promise<DreamMutation[]> {
  return Promise.all(
    mutations.map(async (mutation) => {
      if (mutation.type === 'create' || mutation.type === 'update') {
        const dream = await normalizeDreamForStorage(mutation.dream);
        return { ...mutation, dream };
      }
      return mutation;
    })
  );
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
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
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Row too big')) {
      await removeItem(DREAMS_STORAGE_KEY);
    }
    return [];
  }
}

export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  try {
    const normalized = await normalizeDreamsForStorage(dreams);
    await setItem(DREAMS_STORAGE_KEY, JSON.stringify(normalized));
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
      const parsed = JSON.parse(savedSettings) as unknown;

      // Handle migration from old format with isEnabled to new format with separate flags
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'isEnabled' in parsed &&
        !('weekdayEnabled' in parsed)
      ) {
        const oldFormat = parsed as { isEnabled: boolean; weekdayTime?: string; weekendTime?: string };
        const migratedSettings: NotificationSettings = {
          weekdayEnabled: oldFormat.isEnabled,
          weekdayTime: oldFormat.weekdayTime || '07:00',
          weekendEnabled: oldFormat.isEnabled,
          weekendTime: oldFormat.weekendTime || '10:00',
        };
        // Save migrated settings back to storage
        await saveNotificationSettings(migratedSettings);
        return migratedSettings;
      }

      return parsed as NotificationSettings;
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

export async function getDreamsMigrationSynced(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await getItem(`${DREAMS_MIGRATION_SYNCED_PREFIX}${userId}`)) === 'true';
  } catch {
    return false;
  }
}

export async function setDreamsMigrationSynced(userId: string, synced: boolean): Promise<void> {
  if (!userId) return;
  await setItem(`${DREAMS_MIGRATION_SYNCED_PREFIX}${userId}`, synced ? 'true' : 'false');
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
    const normalized = await normalizeDreamsForStorage(dreams);
    await setItem(REMOTE_DREAMS_CACHE_KEY, JSON.stringify(normalized));
  } catch (error) {
    if (__DEV__) {
      if (isSQLiteBusyError(error)) {
        logger.debug('[storageServiceReal] cache write skipped while SQLite busy');
      } else {
        console.error('Failed to cache remote dreams:', error);
      }
    }
  }
}

export async function clearRemoteDreamStorage(): Promise<void> {
  await Promise.all([
    removeItem(REMOTE_DREAMS_CACHE_KEY),
    removeItem(DREAM_MUTATIONS_KEY),
  ]);
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
    const normalized = await normalizeMutationsForStorage(mutations);
    await setItem(DREAM_MUTATIONS_KEY, JSON.stringify(normalized));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save pending dream mutations:', error);
    }
    throw new Error('Failed to save pending dream mutations');
  }
}
