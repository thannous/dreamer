import { Platform } from 'react-native';

const mockHungSqlite = {
  getItem: jest.fn(() => new Promise<string | null>(() => {})),
  setItem: jest.fn(() => new Promise<void>(() => {})),
  removeItem: jest.fn(() => new Promise<void>(() => {})),
};

const mockWebValues = new Map<string, string>();
const mockWebStorage = {
  getItem: jest.fn(async (key: string) => mockWebValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockWebValues.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockWebValues.delete(key);
  }),
};

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: mockHungSqlite,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockWebStorage,
}));

describe('lucid trainer web storage', () => {
  beforeEach(() => {
    Platform.OS = 'web';
    mockWebValues.clear();
    jest.clearAllMocks();
  });

  it('loads trainer state from AsyncStorage even when SQLite getItem never resolves', async () => {
    // Web SQLite kv-store currently never settles; there is no readable payload
    // to migrate, so Lucid uses AsyncStorage only on this platform.
    expect(Platform.OS).toBe('web');
    const { createInitialLucidTrainerState } = require('@/lib/lucid/domain') as typeof import('@/lib/lucid/domain');
    const {
      getLucidTrainerStorageKeys,
      loadLucidTrainerState,
    } = require('@/services/lucidTrainerStorage') as typeof import('@/services/lucidTrainerStorage');

    const persisted = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'Europe/Paris',
      locale: 'fr',
    });
    const keys = getLucidTrainerStorageKeys('user:user-1');
    mockWebValues.set(keys.state, JSON.stringify(persisted));

    await expect(loadLucidTrainerState('user:user-1')).resolves.toMatchObject({
      source: 'stored',
      state: { schemaVersion: 1, createdAt: persisted.createdAt },
    });
    expect(mockWebStorage.getItem).toHaveBeenCalledWith(keys.state);
    expect(mockHungSqlite.getItem).not.toHaveBeenCalled();
  });
});
