/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const DREAMS_STORAGE_KEY = 'gemini_dream_journal_dreams';
const REMOTE_DREAMS_CACHE_KEY = 'gemini_dream_journal_remote_dreams_cache';
const DREAM_MUTATIONS_KEY = 'gemini_dream_journal_pending_mutations';
const IMAGE_JOBS_KEY = 'gemini_dream_journal_pending_image_jobs';
const RECORDING_TRANSCRIPT_KEY = 'gemini_dream_journal_recording_transcript';
const NOTIFICATION_SETTINGS_KEY = 'gemini_dream_journal_notification_settings';
const THEME_PREFERENCE_KEY = 'gemini_dream_journal_theme_preference';
const LANGUAGE_PREFERENCE_KEY = 'gemini_dream_journal_language_preference';
const RITUAL_PREFERENCE_KEY = 'gemini_dream_journal_ritual_preference';
const RITUAL_PROGRESS_KEY = 'gemini_dream_journal_ritual_progress';
const FIRST_LAUNCH_COMPLETED_KEY = 'gemini_dream_journal_first_launch_completed';
const DREAMS_MIGRATION_SYNCED_PREFIX = 'gemini_dream_journal_dreams_migration_synced_';

const mockAsyncStorage = {
  getItem: jest.fn<(key: string) => Promise<string | null>>(),
  setItem: jest.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: jest.fn<(key: string) => Promise<void>>(),
};

const mockReportSyncQueueClearedWithPending = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock('@/lib/syncObservability', () => ({
  reportSyncQueueClearedWithPending: (...args: unknown[]) =>
    mockReportSyncQueueClearedWithPending(...args),
}));

const createFakeIndexedDB = () => {
  const stores = new Map<string, Map<string, string>>();
  const schedule = (cb: () => void) => Promise.resolve().then(cb);

  class FakeDB {
    onversionchange: (() => void) | null = null;
    objectStoreNames = {
      contains: (name: string) => stores.has(name),
    };

    createObjectStore(name: string) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }
      return {};
    }

    transaction(name: string) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }
      const storeData = stores.get(name)!;
      const tx = { onabort: undefined as undefined | (() => void), oncomplete: undefined as undefined | (() => void), error: null as Error | null };
      const store = {
        get: (key: string) => {
          const request = { result: storeData.get(key), error: null } as any;
          schedule(() => tx.oncomplete?.());
          return request;
        },
        put: (value: string, key: string) => {
          storeData.set(key, value);
          const request = { result: key, error: null } as any;
          schedule(() => tx.oncomplete?.());
          return request;
        },
        delete: (key: string) => {
          storeData.delete(key);
          const request = { result: undefined, error: null } as any;
          schedule(() => tx.oncomplete?.());
          return request;
        },
      };
      (tx as any).objectStore = () => store;
      return tx as any;
    }

    close() {}
  }

  return {
    open: () => {
      const request = { result: new FakeDB(), error: null } as any;
      schedule(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  } as any;
};

describe('storageServiceReal', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    mockAsyncStorage.getItem.mockReset().mockResolvedValue(null);
    mockAsyncStorage.setItem.mockReset().mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockReset().mockResolvedValue(undefined);
    mockReportSyncQueueClearedWithPending.mockReset();
    const { Platform } = require('react-native');
    Platform.OS = 'web';
  });

  it('persists and reads notification settings via localStorage when IndexedDB is unavailable', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      // Force IndexedDB branch to be unavailable so we fall back to localStorage.
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');
      await storage.saveNotificationSettings({
        weekdayEnabled: true,
        weekdayTime: '06:30',
        weekendEnabled: false,
        weekendTime: '10:00',
      });

      expect(localStorage.getItem(NOTIFICATION_SETTINGS_KEY)).toContain('"weekdayEnabled":true');
      const settings = await storage.getNotificationSettings();
      expect(settings).toEqual({
        weekdayEnabled: true,
        weekdayTime: '06:30',
        weekendEnabled: false,
        weekendTime: '10:00',
      });
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('migrates legacy notification settings format (isEnabled) to the new split flags', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify({ isEnabled: true, weekdayTime: '08:15' }),
      );

      const storage = require('../storageServiceReal');
      const settings = await storage.getNotificationSettings();

      expect(settings).toEqual({
        weekdayEnabled: true,
        weekdayTime: '08:15',
        weekendEnabled: true,
        weekendTime: '10:00',
      });

      expect(localStorage.getItem(NOTIFICATION_SETTINGS_KEY)).toBe(
        JSON.stringify(settings),
      );
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('stores dreams on filesystem for native platforms and bypasses AsyncStorage reads', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: jest.fn(async (key: string) => kvStoreData[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const { getInfoAsync } = require('expo-file-system/legacy');
    const getInfoSpy = jest.mocked(getInfoAsync);

    const storage = require('../storageServiceReal');

    const dreams = [
      {
        id: 123,
        title: 'A dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ] as any;

    await storage.saveDreams(dreams);

    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
    expect(kvStore.setItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY, expect.stringContaining('"title":"A dream"'));
    expect(getInfoSpy).not.toHaveBeenCalled();

    mockAsyncStorage.getItem.mockClear();
    const loaded = await storage.getSavedDreams();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('A dream');
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    expect(kvStore.getItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
  });

  it('cleans up native AsyncStorage keys that fail with "Row too big"', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const { getInfoAsync } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false } as any);

    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Row too big'));
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    const storage = require('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded).toEqual([]);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
  });

  it('migrates file-backed dreams into kv-store when available', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    // First run: kv-store unavailable -> saveDreams writes to file.
    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const storageLegacy = require('../storageServiceReal');

    const dreams = [
      {
        id: 123,
        title: 'A dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ] as any;

    await storageLegacy.saveDreams(dreams);

    const { File } = require('expo-file-system');
    const file = new File('/tmp/storage/gemini_dream_journal_dreams.json');
    const persistedDreamsPayload = await file.text();
    expect(persistedDreamsPayload).toContain('"title":"A dream"');

    // Second run: kv-store available -> getSavedDreams migrates file -> kv-store.
    jest.resetModules();
    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: jest.fn(async (key: string) => kvStoreData[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const { Platform: Platform2 } = require('react-native');
    Platform2.OS = 'ios';
    const { File: FileAfterReset } = require('expo-file-system');
    const fileAfterReset = new FileAfterReset('/tmp/storage/gemini_dream_journal_dreams.json');
    fileAfterReset.write(persistedDreamsPayload);

    const { getInfoAsync, deleteAsync } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: true, isDirectory: false } as any);
    const deleteSpy = jest.mocked(deleteAsync);

    const storage = require('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('A dream');
    expect(kvStore.setItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY, expect.any(String));
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('persists transcript data in localStorage on web', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');
      await storage.saveTranscript('draft transcript');

      expect(localStorage.getItem(RECORDING_TRANSCRIPT_KEY)).toBe('draft transcript');
      expect(await storage.getSavedTranscript()).toBe('draft transcript');

      await storage.clearSavedTranscript();
      expect(localStorage.getItem(RECORDING_TRANSCRIPT_KEY)).toBeNull();
      expect(await storage.getSavedTranscript()).toBe('');
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('stores preferences and flags using localStorage on web', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');

      await storage.saveThemePreference('dark');
      await storage.saveLanguagePreference('fr');
      await storage.saveRitualPreference('focus');
      await storage.saveRitualStepProgress({ stepIndex: 2, completedAt: 123 } as any);
      await storage.saveFirstLaunchCompleted(true);
      await storage.setDreamsMigrationSynced('user-1', true);

      expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe(JSON.stringify('dark'));
      expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(JSON.stringify('fr'));
      expect(localStorage.getItem(RITUAL_PREFERENCE_KEY)).toBe(JSON.stringify('focus'));
      expect(localStorage.getItem(RITUAL_PROGRESS_KEY)).toContain('"stepIndex":2');
      expect(localStorage.getItem(FIRST_LAUNCH_COMPLETED_KEY)).toBe(JSON.stringify(true));
      expect(localStorage.getItem(`${DREAMS_MIGRATION_SYNCED_PREFIX}user-1`)).toBe('true');

      expect(await storage.getThemePreference()).toBe('dark');
      expect(await storage.getLanguagePreference()).toBe('fr');
      expect(await storage.getRitualPreference()).toBe('focus');
      expect(await storage.getRitualStepProgress()).toEqual({ stepIndex: 2, completedAt: 123 });
      expect(await storage.getFirstLaunchCompleted()).toBe(true);
      expect(await storage.getDreamsMigrationSynced('user-1')).toBe(true);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('normalizes dreams, cached dreams, and mutations before saving', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');

      const chatHistory = Array.from({ length: 60 }, (_, index) => ({
        role: 'user',
        content: `entry-${index}`,
      }));

      const dream = {
        id: 42,
        title: 'Dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: 'data:image/png;base64,dGVzdA==',
        thumbnailUrl: 'data:image/png;base64,dGVzdA==',
        dreamType: 'Symbolic Dream',
        chatHistory,
        isFavorite: false,
      } as any;

      await storage.saveDreams([dream]);
      await storage.saveCachedRemoteDreams([dream]);
      await storage.savePendingDreamMutations([{ type: 'create', dream }] as any);

      const savedDreams = JSON.parse(localStorage.getItem(DREAMS_STORAGE_KEY) ?? '[]');
      expect(savedDreams).toHaveLength(1);
      expect(savedDreams[0].chatHistory).toHaveLength(50);
      expect(savedDreams[0].imageUrl).toContain('/tmp/dream-images/42.');

      const cachedDreams = JSON.parse(localStorage.getItem(REMOTE_DREAMS_CACHE_KEY) ?? '[]');
      expect(cachedDreams).toHaveLength(1);
      expect(cachedDreams[0].thumbnailUrl).toContain('/tmp/dream-images/42.');

      const pending = JSON.parse(localStorage.getItem(DREAM_MUTATIONS_KEY) ?? '[]');
      expect(pending).toHaveLength(1);
      expect(pending[0].dream.chatHistory).toHaveLength(50);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('migrates localStorage values into IndexedDB when available', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      (globalThis as any).indexedDB = createFakeIndexedDB();
      localStorage.setItem(RECORDING_TRANSCRIPT_KEY, 'legacy transcript');

      const storage = require('../storageServiceReal');
      const migrated = await storage.getSavedTranscript();

      expect(migrated).toBe('legacy transcript');
      expect(localStorage.getItem(RECORDING_TRANSCRIPT_KEY)).toBeNull();

      await storage.saveTranscript('fresh transcript');
      expect(await storage.getSavedTranscript()).toBe('fresh transcript');

      await storage.saveTranscript('');
      expect(await storage.getSavedTranscript()).toBe('');
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('returns sorted dreams and handles invalid JSON', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(
        DREAMS_STORAGE_KEY,
        JSON.stringify([{ id: 2 }, { id: 5 }, { id: 3 }]),
      );

      const storage = require('../storageServiceReal');
      const sorted = await storage.getSavedDreams();

      expect(sorted.map((dream) => dream.id)).toEqual([5, 3, 2]);

      localStorage.setItem(DREAMS_STORAGE_KEY, '{invalid json');
      const fallback = await storage.getSavedDreams();
      expect(fallback).toEqual([]);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('returns empty arrays when cached data is malformed', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(REMOTE_DREAMS_CACHE_KEY, 'not-json');
      localStorage.setItem(DREAM_MUTATIONS_KEY, 'not-json');

      const storage = require('../storageServiceReal');
      expect(await storage.getCachedRemoteDreams()).toEqual([]);
      expect(await storage.getPendingDreamMutations()).toEqual([]);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('logs and falls back when file-backed reads fail in dev', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const { getInfoAsync } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockRejectedValueOnce(new Error('read failure'));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = require('../storageServiceReal');
    await storage.getSavedDreams();
    expect(warnSpy).toHaveBeenCalled();
    (globalThis as any).__DEV__ = originalDev;
  });

  it('throws when file-backed writes fail', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const { makeDirectoryAsync } = require('expo-file-system/legacy');
    jest.mocked(makeDirectoryAsync).mockRejectedValueOnce(new Error('mkdir failed'));

    const storage = require('../storageServiceReal');
    const dreams = [
      {
        id: 1,
        title: 'Dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ] as any;

    await expect(storage.saveDreams(dreams)).rejects.toThrow('Failed to persist dreams to storage');
    (globalThis as any).__DEV__ = originalDev;
  });

  it('logs when file-backed delete fails during kv writes', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: jest.fn(async (key: string) => kvStoreData[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const { deleteAsync } = require('expo-file-system/legacy');
    jest.mocked(deleteAsync).mockRejectedValueOnce(new Error('delete failed'));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = require('../storageServiceReal');
    const dreams = [
      {
        id: 2,
        title: 'Dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ] as any;

    await storage.saveDreams(dreams);

    expect(kvStore.setItem).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    (globalThis as any).__DEV__ = originalDev;
  });

  it('migrates legacy AsyncStorage values into kv-store for file-backed keys', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const legacyValue = JSON.stringify([
      {
        id: 11,
        title: 'Legacy dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ]);
    mockAsyncStorage.getItem.mockResolvedValueOnce(legacyValue);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    const { getInfoAsync } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false } as any);

    const storage = require('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded[0]?.title).toBe('Legacy dream');
    expect(kvStore.setItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY, legacyValue);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);

    (globalThis as any).__DEV__ = originalDev;
    logSpy.mockRestore();
  });

  it('migrates legacy AsyncStorage values into kv-store for non-file-backed keys', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    mockAsyncStorage.getItem.mockImplementation((async (key: string) =>
      key === RECORDING_TRANSCRIPT_KEY ? 'legacy transcript' : null) as any);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    const storage = require('../storageServiceReal');
    const transcript = await storage.getSavedTranscript();

    expect(transcript).toBe('legacy transcript');
    expect(kvStore.setItem).toHaveBeenCalledWith(RECORDING_TRANSCRIPT_KEY, 'legacy transcript');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(RECORDING_TRANSCRIPT_KEY);
  });

  it('moves legacy AsyncStorage data to file storage when kv-store is unavailable', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const legacyValue = JSON.stringify([
      {
        id: 9,
        title: 'Legacy file dream',
        transcript: 'hello',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      },
    ]);
    mockAsyncStorage.getItem.mockResolvedValueOnce(legacyValue);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    const { getInfoAsync, deleteAsync, documentDirectory, cacheDirectory } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false } as any);

    const dir = documentDirectory ?? cacheDirectory ?? '/tmp/';
    const filePath = `${dir}storage/${DREAMS_STORAGE_KEY}.json`;
    await deleteAsync(filePath, { idempotent: true });

    const storage = require('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded[0]?.title).toBe('Legacy file dream');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);

    const { File } = require('expo-file-system');
    const file = new File(filePath);
    expect(await file.text()).toContain('Legacy file dream');
  });

  it('uses memory storage when native stores are unavailable', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });
    jest.doMock('@react-native-async-storage/async-storage', () => {
      throw new Error('async-storage unavailable');
    });

    const storage = require('../storageServiceReal');
    await storage.saveTranscript('draft transcript');

    expect(await storage.getSavedTranscript()).toBe('draft transcript');

    await storage.clearSavedTranscript();
    expect(await storage.getSavedTranscript()).toBe('');
  });

  it('falls back to localStorage when IndexedDB is blocked', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;

    const createBlockedIndexedDB = () => ({
      open: () => {
        const request = {} as any;
        Promise.resolve().then(() => request.onblocked?.());
        return request;
      },
    });

    (globalThis as any).indexedDB = createBlockedIndexedDB();
    localStorage.setItem(RECORDING_TRANSCRIPT_KEY, 'blocked transcript');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = require('../storageServiceReal');

    expect(await storage.getSavedTranscript()).toBe('blocked transcript');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    (globalThis as any).__DEV__ = originalDev;
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  it('logs kv-store hits in dev mode for file-backed keys', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStore = {
      getItem: jest.fn(async () =>
        JSON.stringify([
          {
            id: 31,
            title: 'KV dream',
            transcript: 'hello',
            interpretation: '',
            shareableQuote: '',
            imageUrl: '',
            dreamType: 'Symbolic Dream',
            chatHistory: [],
            isFavorite: false,
          },
        ]),
      ),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const storage = require('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded[0]?.title).toBe('KV dream');
    expect(logSpy).toHaveBeenCalled();

    (globalThis as any).__DEV__ = originalDev;
    logSpy.mockRestore();
  });

  it('warns and returns empty when kv-store read fails in dev', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { Platform } = require('react-native');
    Platform.OS = 'ios';

    const kvStore = {
      getItem: jest.fn(async () => {
        throw new Error('kv read failed');
      }),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const { getInfoAsync } = require('expo-file-system/legacy');
    jest.mocked(getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false } as any);

    const storage = require('../storageServiceReal');
    expect(await storage.getSavedDreams()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    (globalThis as any).__DEV__ = originalDev;
    warnSpy.mockRestore();
  });

  it('persists delete mutations without normalization', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');
      await storage.savePendingDreamMutations([
        { id: 'mutation-1', type: 'delete', createdAt: 123, dreamId: 9 },
      ] as any);

      const stored = JSON.parse(localStorage.getItem(DREAM_MUTATIONS_KEY) ?? '[]');
      expect(stored).toEqual([
        expect.objectContaining({
          id: 'mutation-1',
          type: 'delete',
          createdAt: 123,
          dreamId: 9,
        }),
      ]);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('does not migrate legacy global sync data into a scoped user bucket', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(
        REMOTE_DREAMS_CACHE_KEY,
        JSON.stringify([
          {
            id: 7,
            title: 'Legacy cache',
            transcript: 'hello',
            interpretation: '',
            shareableQuote: '',
            imageUrl: '',
            dreamType: 'Symbolic Dream',
            chatHistory: [],
            isFavorite: false,
          },
        ]),
      );
      localStorage.setItem(
        DREAM_MUTATIONS_KEY,
        JSON.stringify([
          {
            id: 'legacy-mutation',
            type: 'delete',
            createdAt: 123,
            dreamId: 7,
          },
        ]),
      );

      const storage = require('../storageServiceReal');

      expect(await storage.getCachedRemoteDreams('user:user-b')).toEqual([]);
      expect(await storage.getPendingDreamMutations('user:user-b')).toEqual([]);
      expect(localStorage.getItem(`${REMOTE_DREAMS_CACHE_KEY}:user:user-b`)).toBeNull();
      expect(localStorage.getItem(`${DREAM_MUTATIONS_KEY}:user:user-b`)).toBeNull();
      expect(localStorage.getItem(REMOTE_DREAMS_CACHE_KEY)).not.toBeNull();
      expect(localStorage.getItem(DREAM_MUTATIONS_KEY)).not.toBeNull();
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('persists pending image jobs on web storage', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      const storage = require('../storageServiceReal');
      await storage.savePendingImageJobs([
        {
          dreamId: 7,
          jobId: 'job-7',
          clientRequestId: 'image-request-7',
          status: 'queued',
          requestedAt: 123,
        },
      ]);

      const stored = JSON.parse(localStorage.getItem(IMAGE_JOBS_KEY) ?? '[]');
      expect(stored).toEqual([
        {
          dreamId: 7,
          jobId: 'job-7',
          clientRequestId: 'image-request-7',
          status: 'queued',
          requestedAt: 123,
        },
      ]);
      expect(await storage.getPendingImageJobs()).toEqual(stored);
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('alerts before clearing scoped queue data when pending mutations still exist', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(
        `${DREAM_MUTATIONS_KEY}:user:user-1`,
        JSON.stringify([
          {
            version: 1,
            id: 'mutation-1',
            userScope: 'user:user-1',
            entityType: 'dream',
            entityKey: 'local:1',
            operation: 'update',
            clientRequestId: 'request-1',
            clientUpdatedAt: 1000,
            payload: { dreamId: 1 },
            status: 'pending',
            retryCount: 0,
            createdAt: 1000,
          },
        ]),
      );

      const storage = require('../storageServiceReal');
      await storage.clearRemoteDreamStorage('user:user-1');

      expect(mockReportSyncQueueClearedWithPending).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'clear_remote_dream_storage',
          userScope: 'user:user-1',
        })
      );
      expect(localStorage.getItem(`${DREAM_MUTATIONS_KEY}:user:user-1`)).toBeNull();
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });

  it('alerts before clearing when legacy global pending mutations still exist', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      delete (globalThis as any).indexedDB;

      localStorage.setItem(
        DREAM_MUTATIONS_KEY,
        JSON.stringify([
          {
            id: 'legacy-mutation-1',
            type: 'update',
            dreamId: 1,
            createdAt: 1000,
          },
        ]),
      );

      const storage = require('../storageServiceReal');
      await storage.clearRemoteDreamStorage('user:user-1');

      expect(mockReportSyncQueueClearedWithPending).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'clear_remote_dream_storage',
          userScope: 'user:user-1',
          mutations: [
            expect.objectContaining({
              id: 'legacy-mutation-1',
              userScope: 'user:user-1',
              status: 'pending',
            }),
          ],
        })
      );
      expect(localStorage.getItem(DREAM_MUTATIONS_KEY)).toBeNull();
    } finally {
      (globalThis as any).indexedDB = originalIndexedDB;
    }
  });
});
