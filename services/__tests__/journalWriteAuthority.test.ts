import type { DreamAnalysis } from '@/lib/types';

const originalDream: DreamAnalysis = {
  id: 1,
  title: 'Original',
  transcript: 'A fictional dream used only by this test.',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  isAnalyzed: false,
  chatHistory: [],
};

describe('Journal primary storage write authority', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('@/lib/logger', () => ({
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/syncObservability', () => ({
      reportSyncQueueClearedWithPending: jest.fn(),
    }));
  });

  it.each(['{}', '[{}]'])(
    'preserves an invalid pending queue instead of treating %s as empty',
    async (payload) => {
      const primary = {
        getItem: jest.fn(async () => payload),
        setItem: jest.fn(async () => {}),
        removeItem: jest.fn(async () => {}),
      };
      const legacy = {
        getItem: jest.fn(async () => null),
        setItem: jest.fn(async () => {}),
        removeItem: jest.fn(async () => {}),
      };
      jest.doMock('expo-sqlite/kv-store', () => ({ default: primary }));
      jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
      const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');

      await expect(storage.getPendingDreamMutations('user:authority-test')).rejects.toThrow();
      expect(primary.setItem).not.toHaveBeenCalled();
      expect(primary.removeItem).not.toHaveBeenCalled();
      expect(legacy.setItem).not.toHaveBeenCalled();
      expect(legacy.removeItem).not.toHaveBeenCalled();
    }
  );

  it('preserves primary and legacy keys when a pending queue read reports Row too big', async () => {
    const primary = {
      getItem: jest.fn(async () => { throw new Error('Row too big'); }),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    const legacy = {
      getItem: jest.fn(async () => '[]'),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: primary }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
    const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');

    await expect(storage.getPendingDreamMutations('user:authority-test')).rejects.toThrow();
    expect(primary.setItem).not.toHaveBeenCalled();
    expect(primary.removeItem).not.toHaveBeenCalled();
    expect(legacy.getItem).not.toHaveBeenCalled();
    expect(legacy.removeItem).not.toHaveBeenCalled();
  });

  it('retains a durable guest migration owner across module restart and refuses a shadow claim', async () => {
    const values = new Map<string, string>();
    let writeFails = true;
    const primary = {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        if (writeFails) throw new Error('SQLITE_BUSY');
        values.set(key, value);
      }),
      removeItem: jest.fn(async () => {}),
    };
    const legacy = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: primary }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
    const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');
    await expect(storage.setGuestDreamMigrationOwner({ userId: 'account-a', dreamIds: [1] })).rejects.toThrow();
    expect(values.size).toBe(0);
    expect(legacy.setItem).not.toHaveBeenCalled();
    writeFails = false;
    await storage.setGuestDreamMigrationOwner({ userId: 'account-a', dreamIds: [1] });
    jest.resetModules();
    const restarted: typeof import('../storageServiceReal') = require('../storageServiceReal');
    expect(await restarted.getGuestDreamMigrationOwner()).toEqual({ userId: 'account-a', dreamIds: [1] });
    await restarted.setGuestDreamMigrationOwner(null);
    expect(await restarted.getGuestDreamMigrationOwner()).toBeNull();
  });

  it('rejects an unreadable migration owner without treating it as unclaimed', async () => {
    const primary = {
      getItem: jest.fn(async () => { throw new Error('Storage unavailable'); }),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    const legacy = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: primary }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
    const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');
    await expect(storage.getGuestDreamMigrationOwner()).rejects.toThrow();
    expect(primary.setItem).not.toHaveBeenCalled();
    expect(primary.removeItem).not.toHaveBeenCalled();
    expect(legacy.getItem).not.toHaveBeenCalled();
  });

  it.each(['account-cache', 'pending-queue'] as const)(
    'acknowledges a durable web %s write when legacy cleanup fails',
    async (target) => {
      const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const previousIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
      const values = new Map<string, string>();
      const primary = {
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
        removeItem: jest.fn(() => { throw new Error('Legacy cleanup unavailable'); }),
      };
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: primary });
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
      jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
      try {
        const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');
        const scope = 'user:authority-test';
        if (target === 'account-cache') {
          await expect(storage.saveCachedRemoteDreams([originalDream], scope)).resolves.toBeUndefined();
          expect(await storage.getCachedRemoteDreams(scope)).toMatchObject({
            status: 'loaded', value: [originalDream],
          });
        } else {
          await expect(storage.savePendingDreamMutations([], scope)).resolves.toBeUndefined();
          expect(await storage.getPendingDreamMutations(scope)).toEqual([]);
        }
        expect(primary.removeItem).toHaveBeenCalled();
        expect(primary.setItem).toHaveBeenCalledTimes(1);
      } finally {
        if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
        if (previousIndexedDB) Object.defineProperty(globalThis, 'indexedDB', previousIndexedDB);
        else Reflect.deleteProperty(globalThis, 'indexedDB');
      }
    }
  );

  it.each(['journal', 'account-cache'] as const)(
    'rejects a shadow fallback for %s, then reloads the successful retry from the primary store',
    async (target) => {
      const scope = 'user:authority-test';
      const key = target === 'journal'
        ? 'gemini_dream_journal_dreams'
        : `gemini_dream_journal_remote_dreams_cache:${scope}`;
      const primaryValues = new Map([[key, JSON.stringify([originalDream])]]);
      const fileValues = new Map<string, string>();
      let busy = true;
      const primary = {
        getItem: jest.fn(async (storageKey: string) => primaryValues.get(storageKey) ?? null),
        setItem: jest.fn(async (storageKey: string, value: string) => {
          if (busy) throw new Error('SQLITE_BUSY: database is locked');
          primaryValues.set(storageKey, value);
        }),
        removeItem: jest.fn(async () => {}),
      };
      const legacy = {
        getItem: jest.fn(async () => null),
        setItem: jest.fn(async () => {}),
        removeItem: jest.fn(async () => {}),
      };
      jest.doMock('expo-sqlite/kv-store', () => ({ default: primary }));
      jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
      jest.doMock('expo-file-system/legacy', () => ({
        documentDirectory: 'file:///test/',
        cacheDirectory: 'file:///cache/',
        getInfoAsync: jest.fn(async (path: string) => ({ exists: fileValues.has(path) })),
        makeDirectoryAsync: jest.fn(async () => {}),
        deleteAsync: jest.fn(async (path: string) => { fileValues.delete(path); }),
      }));
      jest.doMock('expo-file-system', () => ({
        File: class {
          constructor(private readonly path: string) {}
          async text() { return fileValues.get(this.path) ?? ''; }
          write(value: string) { fileValues.set(this.path, value); }
          delete() { fileValues.delete(this.path); }
        },
      }));

      const storage: typeof import('../storageServiceReal') = require('../storageServiceReal');
      const changed = [{ ...originalDream, title: 'Latest edit' }];
      const save = () => target === 'journal'
        ? storage.saveDreams(changed)
        : storage.saveCachedRemoteDreams(changed, scope);

      await expect(save()).rejects.toThrow();
      expect(JSON.parse(primaryValues.get(key)!)).toEqual([originalDream]);
      expect(fileValues.size).toBe(0);
      expect(legacy.setItem).not.toHaveBeenCalled();

      busy = false;
      await save();
      // A fresh module instance must find the acknowledged write, without relying on memory.
      jest.resetModules();
      const restarted: typeof import('../storageServiceReal') = require('../storageServiceReal');
      const result = target === 'journal'
        ? await restarted.getSavedDreams()
        : await restarted.getCachedRemoteDreams(scope);
      expect(result).toMatchObject({ status: 'loaded', value: changed });
    }
  );
});
