import { vi } from 'vitest';

// Silence missing native driver warnings in tests.
vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

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
vi.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Provide a lightweight Constants mock used by lib/config and other imports.
vi.mock('expo-constants', () => ({
  default: {
    appOwnership: 'standalone',
    nativeAppVersion: '0.0.0',
    expoConfig: { extra: {} },
    manifest: null,
  },
}));

// Avoid loading native/react-native specific logic from expo-modules-core in unit tests.
vi.mock('expo-modules-core', () => ({
  CodedError: class CodedError extends Error {},
  EventEmitter: class {
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    emit() {}
  },
  NativeModulesProxy: {},
  requireNativeModule: vi.fn(),
}));

// Some dependencies pull URL polyfills meant for RN; avoid bundling heavy/unsupported code in unit tests.
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('react-native-url-polyfill', () => ({}));

// Stub secure store to satisfy supabase client helpers in tests.
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
  isAvailableAsync: vi.fn().mockResolvedValue(true),
}));

vi.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    base64() {
      return '';
    }
  }

  return {
    File: MockFile,
    ExpoFileSystem: { FileSystemFile: class {} },
    documentDirectory: '/tmp/',
    cacheDirectory: '/tmp/',
    readAsStringAsync: vi.fn().mockResolvedValue(''),
    writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
    deleteAsync: vi.fn().mockResolvedValue(undefined),
    getInfoAsync: vi.fn().mockResolvedValue({ exists: true }),
    makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
    EncodingType: { Base64: 'base64' },
    FileSystemUploadType: { RAW: 'raw' },
  };
});

process.env.EXPO_PUBLIC_MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE ?? 'false';
