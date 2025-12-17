/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DREAMS_STORAGE_KEY = 'gemini_dream_journal_dreams';
const NOTIFICATION_SETTINGS_KEY = 'gemini_dream_journal_notification_settings';

describe('storageServiceReal', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    const { Platform } = await import('react-native');
    Platform.OS = 'web';
  });

  it('persists and reads notification settings via localStorage when IndexedDB is unavailable', async () => {
    const originalIndexedDB = (globalThis as any).indexedDB;
    try {
      // Force IndexedDB branch to be unavailable so we fall back to localStorage.
      delete (globalThis as any).indexedDB;

      const storage = await import('../storageServiceReal');
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

      const storage = await import('../storageServiceReal');
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
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';

    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: vi.fn(async (key: string) => kvStoreData[key] ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    vi.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const asyncStorageModule = await import('@react-native-async-storage/async-storage');
    const AsyncStorage = ('default' in asyncStorageModule ? asyncStorageModule.default : asyncStorageModule) as any;
    const removeItemSpy = vi.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);
    const getItemSpy = vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);

    const { getInfoAsync } = await import('expo-file-system/legacy');
    const getInfoSpy = vi.mocked(getInfoAsync);

    const storage = await import('../storageServiceReal');

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

    expect(removeItemSpy).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
    expect(kvStore.setItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY, expect.stringContaining('"title":"A dream"'));
    expect(getInfoSpy).not.toHaveBeenCalled();

    getItemSpy.mockClear();
    const loaded = await storage.getSavedDreams();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('A dream');
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(kvStore.getItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
  });

  it('cleans up native AsyncStorage keys that fail with "Row too big"', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';

    const { getInfoAsync } = await import('expo-file-system/legacy');
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false } as any);

    vi.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const asyncStorageModule = await import('@react-native-async-storage/async-storage');
    const AsyncStorage = ('default' in asyncStorageModule ? asyncStorageModule.default : asyncStorageModule) as any;
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Row too big'));
    const removeItemSpy = vi.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);

    const storage = await import('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded).toEqual([]);
    expect(removeItemSpy).toHaveBeenCalledWith(DREAMS_STORAGE_KEY);
  });

  it('migrates file-backed dreams into kv-store when available', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';

    // First run: kv-store unavailable -> saveDreams writes to file.
    vi.doMock('expo-sqlite/kv-store', () => {
      throw new Error('kv-store unavailable');
    });

    const storageLegacy = await import('../storageServiceReal');

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

    const { File } = await import('expo-file-system');
    const file = new File('/tmp/storage/gemini_dream_journal_dreams.json');
    expect(await file.text()).toContain('"title":"A dream"');

    // Second run: kv-store available -> getSavedDreams migrates file -> kv-store.
    vi.resetModules();
    const kvStoreData: Record<string, string> = {};
    const kvStore = {
      getItem: vi.fn(async (key: string) => kvStoreData[key] ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        kvStoreData[key] = value;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete kvStoreData[key];
      }),
    };
    vi.doMock('expo-sqlite/kv-store', () => ({ default: kvStore }));

    const { Platform: Platform2 } = await import('react-native');
    Platform2.OS = 'ios';

    const { getInfoAsync, deleteAsync } = await import('expo-file-system/legacy');
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, isDirectory: false } as any);
    const deleteSpy = vi.mocked(deleteAsync);

    const storage = await import('../storageServiceReal');
    const loaded = await storage.getSavedDreams();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('A dream');
    expect(kvStore.setItem).toHaveBeenCalledWith(DREAMS_STORAGE_KEY, expect.any(String));
    expect(deleteSpy).toHaveBeenCalled();
  });
});
