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

function loadStorage(os: 'web' | 'ios' | 'android') {
  jest.resetModules();
  if (os === 'web') {
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: mockAsyncStorage,
    }));
    jest.doMock('expo-sqlite/kv-store', () => {
      throw new Error('expo-sqlite/kv-store should not load on web');
    });
  } else {
    jest.doMock('@react-native-async-storage/async-storage', () => {
      throw new Error('AsyncStorage should not load on native');
    });
    jest.doMock('expo-sqlite/kv-store', () => ({
      __esModule: true,
      default: mockSqlite,
    }));
  }
  const { Platform } = require('react-native') as typeof import('react-native');
  Platform.OS = os;
  return require('@/services/lucidKeyValueStorage') as typeof import('@/services/lucidKeyValueStorage');
}

describe('lucidKeyValueStorage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('selects AsyncStorage on web without evaluating expo-sqlite/kv-store', () => {
    const {
      getLucidKeyValueStorage,
      isLucidNativeKeyValueStorage,
    } = loadStorage('web');

    const storage = getLucidKeyValueStorage();
    expect(storage).toBe(mockAsyncStorage);
    expect(isLucidNativeKeyValueStorage(storage)).toBe(false);
    expect(isLucidNativeKeyValueStorage(mockSqlite)).toBe(false);
  });

  it('keeps expo-sqlite/kv-store on native without evaluating AsyncStorage', () => {
    const {
      getLucidKeyValueStorage,
      isLucidNativeKeyValueStorage,
    } = loadStorage('ios');

    const storage = getLucidKeyValueStorage();
    expect(storage).toBe(mockSqlite);
    expect(isLucidNativeKeyValueStorage(storage)).toBe(true);
    expect(isLucidNativeKeyValueStorage(mockAsyncStorage)).toBe(false);
  });

  it('never treats an injected memory store as native SQLite storage', () => {
    const { isLucidNativeKeyValueStorage } = loadStorage('android');

    expect(
      isLucidNativeKeyValueStorage({
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      })
    ).toBe(false);
  });
});
