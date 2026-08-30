import { Platform } from 'react-native';

export type LucidKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type ModuleWithDefault<T> = T & { default?: T };

let webStorage: LucidKeyValueStorage | undefined;
let nativeStorage: LucidKeyValueStorage | undefined;

function unwrapStorage(mod: ModuleWithDefault<LucidKeyValueStorage>): LucidKeyValueStorage {
  return 'default' in mod && mod.default ? mod.default : mod;
}

function getWebStorage(): LucidKeyValueStorage {
  if (!webStorage) {
    // Static require stays inside the web branch so native/Jest never evaluates
    // AsyncStorage.native.ts (`NativeModule: AsyncStorage is null`).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as ModuleWithDefault<LucidKeyValueStorage>;
    webStorage = unwrapStorage(mod);
  }
  return webStorage;
}

function getNativeStorage(): LucidKeyValueStorage {
  if (!nativeStorage) {
    // Web `expo-sqlite/kv-store` never resolves getItem in the current runtime
    // (WASM/COOP-COEP). There is therefore no readable SQLite web payload to
    // migrate; Lucid local state on web uses AsyncStorage only.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-sqlite/kv-store') as ModuleWithDefault<LucidKeyValueStorage>;
    nativeStorage = unwrapStorage(mod);
  }
  return nativeStorage;
}

export function getLucidKeyValueStorage(): LucidKeyValueStorage {
  return Platform.OS === 'web' ? getWebStorage() : getNativeStorage();
}

export function isLucidNativeKeyValueStorage(
  storage: LucidKeyValueStorage
): boolean {
  if (Platform.OS === 'web') return false;
  return storage === getNativeStorage();
}
