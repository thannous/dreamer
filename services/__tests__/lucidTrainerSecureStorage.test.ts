import { Platform } from 'react-native';
import { aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  isLucidTrainerStorageCapacityError,
  isLucidTrainerEncryptedValue,
  isLucidTrainerEncryptedValueError,
  LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES,
  protectLucidTrainerStoredValue,
  resetLucidTrainerSecureStorageForTesting,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const mockSecureItems = new Map<string, string>();
let mockNonceCounter = 0;

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync: jest.fn(async () => true),
  getItemAsync: jest.fn(async (key: string) => mockSecureItems.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureItems.set(key, value);
  }),
}));

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');

  class MockKey {
    readonly mockRaw: Buffer;

    constructor(value: Buffer) {
      this.mockRaw = value;
    }

    static async generate() {
      return new MockKey(Buffer.alloc(32, 0x5a));
    }

    static async import(value: string, encoding: 'base64') {
      return new MockKey(Buffer.from(value, encoding));
    }

    async encoded(encoding: 'base64') {
      return this.mockRaw.toString(encoding);
    }
  }

  class MockSealedData {
    readonly mockRaw: Buffer;

    constructor(value: Buffer) {
      this.mockRaw = value;
    }

    static fromCombined(value: string | Uint8Array, _config?: { ivLength: number; tagLength: number }) {
      if (typeof value === 'string') {
        throw new TypeError('Android fromCombined expects a ByteArray, not a base64 string');
      }
      return new MockSealedData(Buffer.from(value));
    }

    async combined(encoding: 'base64') {
      return this.mockRaw.toString(encoding);
    }
  }

  return {
    AESKeySize: { AES256: 256 },
    AESEncryptionKey: MockKey,
    AESSealedData: MockSealedData,
    aesEncryptAsync: jest.fn(
      async (
        plaintext: Uint8Array,
        key: MockKey,
        options: { additionalData?: Uint8Array }
      ) => {
        const nonce = Buffer.alloc(12);
        nonce.writeUInt32BE(++mockNonceCounter, 8);
        const cipher = crypto.createCipheriv('aes-256-gcm', key.mockRaw, nonce);
        if (options.additionalData) {
          cipher.setAAD(Buffer.from(options.additionalData));
        }
        const ciphertext = Buffer.concat([
          cipher.update(Buffer.from(plaintext)),
          cipher.final(),
        ]);
        return new MockSealedData(
          Buffer.concat([nonce, ciphertext, cipher.getAuthTag()])
        );
      }
    ),
    aesDecryptAsync: jest.fn(
      async (
        sealed: MockSealedData,
        key: MockKey,
        options: { additionalData?: Uint8Array }
      ) => {
        const nonce = sealed.mockRaw.subarray(0, 12);
        const tag = sealed.mockRaw.subarray(sealed.mockRaw.length - 16);
        const ciphertext = sealed.mockRaw.subarray(12, sealed.mockRaw.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key.mockRaw, nonce);
        decipher.setAuthTag(tag);
        if (options.additionalData) {
          decipher.setAAD(Buffer.from(options.additionalData));
        }
        return new Uint8Array(
          Buffer.concat([decipher.update(ciphertext), decipher.final()])
        );
      }
    ),
  };
});

async function expectEncryptedValueError(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error('Expected encrypted value corruption');
  } catch (error) {
    expect(isLucidTrainerEncryptedValueError(error)).toBe(true);
  }
}

describe('lucidTrainerSecureStorage', () => {
  const STORAGE_KEY = 'noctalia_lucid_trainer:user%3Aone:state_v1';

  beforeEach(() => {
    Platform.OS = 'ios';
    mockSecureItems.clear();
    mockNonceCounter = 0;
    jest.clearAllMocks();
    resetLucidTrainerSecureStorageForTesting();
  });

  afterAll(() => {
    Platform.OS = 'web';
  });

  it('round-trips AES-GCM values with a fresh nonce and a device-only key', async () => {
    const first = await protectLucidTrainerStoredValue(STORAGE_KEY, 'private dream');
    const second = await protectLucidTrainerStoredValue(STORAGE_KEY, 'private dream');

    expect(isLucidTrainerEncryptedValue(first)).toBe(true);
    expect(first).not.toContain('private dream');
    expect(first).not.toBe(second);
    await expect(revealLucidTrainerStoredValue(STORAGE_KEY, first)).resolves.toBe(
      'private dream'
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'noctalia-lucid-trainer-device-key-v1',
      expect.any(String),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }
    );
  });

  it('decrypts immediately and after a process-like key cache reset', async () => {
    const encrypted = await protectLucidTrainerStoredValue(STORAGE_KEY, 'completed onboarding');

    await expect(revealLucidTrainerStoredValue(STORAGE_KEY, encrypted)).resolves.toBe(
      'completed onboarding'
    );

    resetLucidTrainerSecureStorageForTesting();

    await expect(revealLucidTrainerStoredValue(STORAGE_KEY, encrypted)).resolves.toBe(
      'completed onboarding'
    );
    expect(SecureStore.getItemAsync).toHaveBeenCalled();
  });

  it('authenticates the full storage key as AAD', async () => {
    const encrypted = await protectLucidTrainerStoredValue(
      STORAGE_KEY,
      'account one'
    );

    await expectEncryptedValueError(
      revealLucidTrainerStoredValue(
        'noctalia_lucid_trainer:user%3Atwo:state_v1',
        encrypted
      )
    );
    await expect(revealLucidTrainerStoredValue(STORAGE_KEY, encrypted)).resolves.toBe(
      'account one'
    );
  });

  it('rejects tampering and malformed or truncated envelopes as corruption', async () => {
    const encrypted = await protectLucidTrainerStoredValue(STORAGE_KEY, 'intact');
    const last = encrypted.at(-2) === 'A' ? 'B' : 'A';
    const tampered = `${encrypted.slice(0, -2)}${last}=`;

    for (const value of [
      tampered,
      'noctalia-lucid-aesgcm-v1:',
      'noctalia-lucid-aesgcm-v1:not base64',
      'noctalia-lucid-aesgcm-v1:AAAA',
    ]) {
      await expectEncryptedValueError(
        revealLucidTrainerStoredValue(STORAGE_KEY, value)
      );
    }
  });

  it('round-trips the largest UTF-8 payload accepted by the encrypted envelope', async () => {
    const plaintext = 'a'.repeat(LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES);

    const encrypted = await protectLucidTrainerStoredValue(STORAGE_KEY, plaintext);

    expect(encrypted).toHaveLength(1_999_997);
    await expect(revealLucidTrainerStoredValue(STORAGE_KEY, encrypted)).resolves.toBe(
      plaintext
    );
  });

  it('rejects an oversized UTF-8 payload before key access or encryption', async () => {
    const persist = jest.fn();
    const existingValue = 'existing encrypted value';
    let storedValue = existingValue;
    const oversized = 'é'.repeat(
      Math.floor(LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES / 2) + 1
    );

    try {
      await protectLucidTrainerStoredValue(STORAGE_KEY, oversized).then((value) => {
        persist(value);
        storedValue = value;
      });
      throw new Error('Expected encrypted storage capacity rejection');
    } catch (error) {
      expect(isLucidTrainerStorageCapacityError(error)).toBe(true);
      expect(error).toMatchObject({
        name: 'LucidTrainerStorageCapacityError',
        code: 'storage_capacity_exceeded',
        actualBytes: LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES + 1,
        maxBytes: LUCID_TRAINER_MAX_ENCRYPTED_PLAINTEXT_BYTES,
      });
    }

    expect(persist).not.toHaveBeenCalled();
    expect(storedValue).toBe(existingValue);
    expect(SecureStore.isAvailableAsync).not.toHaveBeenCalled();
    expect(aesEncryptAsync).not.toHaveBeenCalled();
  });

  it('does not misclassify a temporarily unavailable keystore as corrupt data', async () => {
    const encrypted = await protectLucidTrainerStoredValue(STORAGE_KEY, 'recoverable');
    resetLucidTrainerSecureStorageForTesting();
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error('device_locked'));

    await expect(
      revealLucidTrainerStoredValue(STORAGE_KEY, encrypted)
    ).rejects.toThrow('device_locked');
  });

  it('keeps web values plaintext without accessing the device keystore', async () => {
    Platform.OS = 'web';

    await expect(
      protectLucidTrainerStoredValue(STORAGE_KEY, 'browser value')
    ).resolves.toBe('browser value');
    expect(SecureStore.isAvailableAsync).not.toHaveBeenCalled();
  });
});
