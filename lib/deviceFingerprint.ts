import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'device-fingerprint-v1';
let memoized: string | null = null;

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
