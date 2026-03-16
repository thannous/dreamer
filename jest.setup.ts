import { jest } from '@jest/globals';

// Vitest provided this helper; keep behavior stable for existing tests.
const jestAny = jest as any;

jestAny.hoisted = <T>(factory: () => T) => factory();
jestAny.stubGlobal = (key: string, value: unknown) => {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

if ((globalThis as any).jest) {
  (globalThis as any).jest.hoisted = jestAny.hoisted;
  (globalThis as any).jest.stubGlobal = jestAny.stubGlobal;
}

// Silence missing native driver warnings in tests.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

// Expo modules expect these globals during evaluation.
// Keep a single definition here to avoid redefining in each test.
(globalThis as any).__DEV__ = (globalThis as any).__DEV__ ?? false;

const expoGlobal = (globalThis as any).expo ?? {};
expoGlobal.EventEmitter =
  expoGlobal.EventEmitter ??
  class {
    // Minimal shim to satisfy expo-modules-core EventEmitter usage in tests.
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    emit() {}
  };
(globalThis as any).expo = expoGlobal;

// expo-modules-core pulls TurboModuleRegistry directly; provide a stub.
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}), { virtual: true });

// Provide a lightweight Constants mock used by lib/config and other imports.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: 'standalone',
    nativeAppVersion: '0.0.0',
    expoConfig: { extra: {} },
    manifest: null,
  },
}));

// Avoid loading native/react-native specific logic from expo-modules-core in unit tests.
jest.mock('expo-modules-core', () => ({
  CodedError: class CodedError extends Error {},
  EventEmitter: class {
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    emit() {}
  },
  NativeModule: class NativeModule<T = any> {
    // Minimal stub so legacy Expo modules can extend this base class during tests.
    constructor(..._args: any[]) {}
  },
  NativeModulesProxy: {},
  requireNativeModule: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
}));

// Some dependencies pull URL polyfills meant for RN; avoid heavy/unsupported code in unit tests.
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('react-native-url-polyfill', () => ({}));

// Stub secure store to satisfy supabase client helpers in tests.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  isAvailableAsync: jest.fn(async () => true),
}));

// Mock expo-crypto for fingerprint generation in tests.
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
  digestStringAsync: jest.fn(async () => 'mock-hash-fingerprint'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('expo-file-system', () => {
  const fileContents = new Map<string, string>();

  class MockFile {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    base64() {
      return '';
    }
    async text() {
      return fileContents.get(this.uri) ?? '';
    }
    write(value: string) {
      fileContents.set(this.uri, value);
    }
  }

  return {
    File: MockFile,
    ExpoFileSystem: { FileSystemFile: class {} },
    documentDirectory: '/tmp/',
    cacheDirectory: '/tmp/',
    readAsStringAsync: jest.fn(async () => ''),
    writeAsStringAsync: jest.fn(async () => undefined),
    deleteAsync: jest.fn(async () => undefined),
    getInfoAsync: jest.fn(async () => ({ exists: true })),
    makeDirectoryAsync: jest.fn(async () => undefined),
    EncodingType: { Base64: 'base64' },
    FileSystemUploadType: { RAW: 'raw' },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/tmp/',
  cacheDirectory: '/tmp/',
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  EncodingType: { Base64: 'base64' },
  FileSystemUploadType: { RAW: 'raw' },
}));

process.env.EXPO_PUBLIC_MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE ?? 'false';
