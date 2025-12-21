import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'device-fingerprint-v1';
const ACCOUNT_CREATED_KEY = 'device-account-created-v1';

let memoized: string | null = null;
let accountCreatedMemoized: boolean | null = null;

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

async function safeRead(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function safeWrite(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, value);
  } catch {
    // If secure storage is unavailable (e.g., web), we silently skip persistence
  }
}

async function getPlatformIdentifier(): Promise<string | null> {
  if (Platform.OS === 'android') {
    try {
      return Application.getAndroidId() ?? null;
    } catch {
      return null;
    }
  }

  if (Platform.OS === 'ios') {
    try {
      return (await Application.getIosIdForVendorAsync()) ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Returns a pseudonymous device fingerprint hashed with SHA-256 and persisted in secure storage.
 * Used for rate-limit/quota purposes without exposing raw device identifiers.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (memoized) {
    return memoized;
  }

  const stored = await safeRead();
  if (stored) {
    memoized = stored;
    return stored;
  }

  const platformId = await getPlatformIdentifier();
  const raw = platformId || Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);

  await safeWrite(hashed);
  memoized = hashed;
  return hashed;
}

/**
 * Marks that an account has been created on this device.
 * Once set, guest mode will be blocked for this device.
 */
export async function markAccountCreatedOnDevice(): Promise<void> {
  accountCreatedMemoized = true;

  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.setItem(ACCOUNT_CREATED_KEY, 'true');
      return;
    } catch {
      // Fall back to in-memory memoization only.
    }
  }

  try {
    await SecureStore.setItemAsync(ACCOUNT_CREATED_KEY, 'true');
  } catch {
    // If secure storage is unavailable (e.g., web), we silently skip persistence
  }
}

/**
 * Checks if an account was ever created on this device.
 * Used to block guest mode for returning users who logged out.
 */
export async function wasAccountCreatedOnDevice(): Promise<boolean> {
  if (accountCreatedMemoized !== null) {
    return accountCreatedMemoized;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      const value = webStorage.getItem(ACCOUNT_CREATED_KEY);
      accountCreatedMemoized = value === 'true';
      return accountCreatedMemoized;
    } catch {
      return false;
    }
  }

  try {
    const value = await SecureStore.getItemAsync(ACCOUNT_CREATED_KEY);
    accountCreatedMemoized = value === 'true';
    return accountCreatedMemoized;
  } catch {
    return false;
  }
}
