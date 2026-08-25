import {
  AESKeySize,
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ENVELOPE_PREFIX = 'noctalia-lucid-aesgcm-v1:';
const DEVICE_KEY = 'noctalia-lucid-trainer-device-key-v1';
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const MIN_GCM_COMBINED_BYTES = GCM_NONCE_BYTES + GCM_TAG_BYTES;
const MAX_ENCRYPTED_VALUE_LENGTH = 2_000_000;
const MAX_ENCRYPTED_BASE64_GROUPS = Math.floor(
  (MAX_ENCRYPTED_VALUE_LENGTH - ENVELOPE_PREFIX.length) / 4
);

/** Maximum UTF-8 payload that can always fit in the persisted AES-GCM envelope. */
export const LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES =
  MAX_ENCRYPTED_BASE64_GROUPS * 3 - MIN_GCM_COMBINED_BYTES;

let keyPromise: Promise<AESEncryptionKey> | null = null;

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  const length = Math.floor((sanitized.length * 3) / 4) - padding;
  const output = new Uint8Array(length);
  let byteIndex = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const enc1 = Math.max(0, chars.indexOf(sanitized[i]));
    const enc2 = Math.max(0, chars.indexOf(sanitized[i + 1]));
    const enc3 = sanitized[i + 2] === '=' ? 0 : Math.max(0, chars.indexOf(sanitized[i + 2]));
    const enc4 = sanitized[i + 3] === '=' ? 0 : Math.max(0, chars.indexOf(sanitized[i + 3]));
    const chunk = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);
    if (byteIndex < length) output[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < length) output[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < length) output[byteIndex++] = chunk & 0xff;
  }
  return output;
}

async function getDeviceKey(): Promise<AESEncryptionKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const available = await SecureStore.isAvailableAsync();
    if (!available) throw new Error('Secure device storage is unavailable');
    const stored = await SecureStore.getItemAsync(DEVICE_KEY);
    if (stored) return AESEncryptionKey.import(stored, 'base64');

    const generated = await AESEncryptionKey.generate(AESKeySize.AES256);
    await SecureStore.setItemAsync(DEVICE_KEY, await generated.encoded('base64'), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return generated;
  })();

  try {
    return await keyPromise;
  } catch (error) {
    keyPromise = null;
    throw error;
  }
}

export function isLucidTrainerEncryptedValue(value: string): boolean {
  return value.startsWith(ENVELOPE_PREFIX);
}

export class LucidTrainerEncryptedValueError extends Error {
  readonly code = 'invalid_encrypted_value';

  constructor(cause?: unknown) {
    super('Invalid encrypted Lucid Trainer value', { cause });
    this.name = 'LucidTrainerEncryptedValueError';
  }
}

export class LucidTrainerStorageCapacityError extends Error {
  readonly code = 'storage_capacity_exceeded';

  constructor(
    readonly actualBytes: number,
    readonly maxBytes = LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES
  ) {
    super(`Lucid Trainer value exceeds encrypted storage capacity (${actualBytes}/${maxBytes} bytes)`);
    this.name = 'LucidTrainerStorageCapacityError';
  }
}

export function isLucidTrainerEncryptedValueError(
  value: unknown
): value is LucidTrainerEncryptedValueError {
  return value instanceof LucidTrainerEncryptedValueError;
}

export function isLucidTrainerStorageCapacityError(
  value: unknown
): value is LucidTrainerStorageCapacityError {
  return value instanceof LucidTrainerStorageCapacityError;
}

function assertStorageKey(storageKey: string): void {
  if (!storageKey || storageKey.length > 1_024) {
    throw new Error('Invalid Lucid Trainer storage key');
  }
}

function assertEncryptedEnvelope(storedValue: string): string {
  if (
    storedValue.length > MAX_ENCRYPTED_VALUE_LENGTH ||
    !isLucidTrainerEncryptedValue(storedValue)
  ) {
    throw new LucidTrainerEncryptedValueError();
  }
  const combined = storedValue.slice(ENVELOPE_PREFIX.length);
  if (
    combined.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(combined) ||
    combined.length % 4 !== 0
  ) {
    throw new LucidTrainerEncryptedValueError();
  }
  const decodedBytes = Math.floor((combined.length * 3) / 4) -
    (combined.endsWith('==') ? 2 : combined.endsWith('=') ? 1 : 0);
  if (decodedBytes < MIN_GCM_COMBINED_BYTES) {
    throw new LucidTrainerEncryptedValueError();
  }
  return combined;
}

/**
 * Encrypts a persisted Lucid Trainer value with AES-256-GCM. The storage key is
 * authenticated as AAD so ciphertext cannot be moved between users or queues.
 * Web keeps its platform storage behavior; release candidates are native.
 */
export async function protectLucidTrainerStoredValue(
  storageKey: string,
  plaintext: string
): Promise<string> {
  if (Platform.OS === 'web') return plaintext;
  assertStorageKey(storageKey);
  const plaintextBytes = bytes(plaintext);
  if (plaintextBytes.byteLength > LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES) {
    throw new LucidTrainerStorageCapacityError(plaintextBytes.byteLength);
  }
  const key = await getDeviceKey();
  const sealed = await aesEncryptAsync(plaintextBytes, key, {
    additionalData: bytes(storageKey),
  });
  return `${ENVELOPE_PREFIX}${await sealed.combined('base64')}`;
}

export async function revealLucidTrainerStoredValue(
  storageKey: string,
  storedValue: string
): Promise<string> {
  if (!isLucidTrainerEncryptedValue(storedValue)) return storedValue;
  assertStorageKey(storageKey);
  const combined = assertEncryptedEnvelope(storedValue);
  const key = await getDeviceKey();
  try {
    // Expo Crypto 57 leaves a base64 string as-is; Android fromCombined
    // expects a ByteArray. Decode before crossing the native bridge.
    const decrypted = await aesDecryptAsync(
      AESSealedData.fromCombined(decodeBase64ToBytes(combined), {
        ivLength: GCM_NONCE_BYTES,
        tagLength: GCM_TAG_BYTES,
      }),
      key,
      { additionalData: bytes(storageKey) }
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
  } catch (error) {
    throw new LucidTrainerEncryptedValueError(error);
  }
}

export function resetLucidTrainerSecureStorageForTesting(): void {
  keyPromise = null;
}
