import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

export type LucidKeyValueStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

const sqliteStorage = SQLite as LucidKeyValueStorage;
const webStorage = AsyncStorage as LucidKeyValueStorage;

/**
 * Web `expo-sqlite/kv-store` never resolves `getItem` in the current runtime
 * (WASM/COOP-COEP). There is therefore no readable SQLite web payload to migrate;
 * Lucid local state on web uses AsyncStorage only.
 */
export function getLucidKeyValueStorage(): LucidKeyValueStorage {
  return Platform.OS === 'web' ? webStorage : sqliteStorage;
}

export function isLucidNativeKeyValueStorage(
  storage: LucidKeyValueStorage
): boolean {
  return Platform.OS !== 'web' && storage === sqliteStorage;
}
