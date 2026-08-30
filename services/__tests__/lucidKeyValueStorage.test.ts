import { Platform } from 'react-native';

const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

const mockSqlite = {
  getItem: jest.fn(async () => new Promise<string | null>(() => {})),
  setItem: jest.fn(async () => new Promise<void>(() => {})),
  removeItem: jest.fn(async () => new Promise<void>(() => {})),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: mockSqlite,
}));

describe('lucidKeyValueStorage', () => {
  afterEach(() => {
    Platform.OS = 'web';
    jest.clearAllMocks();
  });

  it('selects AsyncStorage on web and never calls the hung SQLite backend', () => {
    Platform.OS = 'web';
    const {
      getLucidKeyValueStorage,
      isLucidNativeKeyValueStorage,
    } = require('@/services/lucidKeyValueStorage') as typeof import('@/services/lucidKeyValueStorage');

    const storage = getLucidKeyValueStorage();
    expect(storage).toBe(mockAsyncStorage);
    expect(isLucidNativeKeyValueStorage(storage)).toBe(false);
    expect(isLucidNativeKeyValueStorage(mockSqlite)).toBe(false);
    expect(mockSqlite.getItem).not.toHaveBeenCalled();
  });

  it('keeps expo-sqlite/kv-store on native and treats only that identity as encrypted storage', () => {
    Platform.OS = 'ios';
    const {
      getLucidKeyValueStorage,
      isLucidNativeKeyValueStorage,
    } = require('@/services/lucidKeyValueStorage') as typeof import('@/services/lucidKeyValueStorage');

    const storage = getLucidKeyValueStorage();
    expect(storage).toBe(mockSqlite);
    expect(isLucidNativeKeyValueStorage(storage)).toBe(true);
    expect(isLucidNativeKeyValueStorage(mockAsyncStorage)).toBe(false);
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('never treats an injected memory store as native SQLite storage', () => {
    Platform.OS = 'android';
    const {
      isLucidNativeKeyValueStorage,
    } = require('@/services/lucidKeyValueStorage') as typeof import('@/services/lucidKeyValueStorage');

    expect(
      isLucidNativeKeyValueStorage({
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      })
    ).toBe(false);
  });
});
