import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Hoist mocks
const {
  mockGetItemAsync,
  mockSetItemAsync,
  mockGetAndroidId,
  mockGetIosIdForVendorAsync,
  mockDigestStringAsync,
  mockRandomUUID,
} = ((factory: any) => factory())(() => ({
  mockGetItemAsync: jest.fn(),
  mockSetItemAsync: jest.fn(),
  mockGetAndroidId: jest.fn(),
  mockGetIosIdForVendorAsync: jest.fn(),
  mockDigestStringAsync: jest.fn(),
  mockRandomUUID: jest.fn(),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: mockGetItemAsync,
  setItemAsync: mockSetItemAsync,
}));

// Mock Application
jest.mock('expo-application', () => ({
  getAndroidId: mockGetAndroidId,
  getIosIdForVendorAsync: mockGetIosIdForVendorAsync,
}));

// Mock Crypto
jest.mock('expo-crypto', () => ({
  digestStringAsync: mockDigestStringAsync,
  randomUUID: mockRandomUUID,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

describe('deviceFingerprint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset memoized value by resetting module
    jest.resetModules();
  });

  describe('getDeviceFingerprint', () => {
    it('given stored fingerprint when getting then returns stored value', async () => {
      mockGetItemAsync.mockResolvedValue('stored-fingerprint-hash');

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('stored-fingerprint-hash');
      expect(mockGetItemAsync).toHaveBeenCalledWith('device-fingerprint-v1');
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('given no stored fingerprint when getting then generates and stores new one', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockGetAndroidId.mockReturnValue('android-device-id');
      mockDigestStringAsync.mockResolvedValue('hashed-fingerprint');

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('hashed-fingerprint');
      expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', 'android-device-id');
      expect(mockSetItemAsync).toHaveBeenCalledWith('device-fingerprint-v1', 'hashed-fingerprint');
    });

    it('given no platform identifier when getting then uses random UUID', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockGetAndroidId.mockReturnValue(null);
      mockRandomUUID.mockReturnValue('random-uuid');
      mockDigestStringAsync.mockResolvedValue('hashed-uuid');

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('hashed-uuid');
      expect(mockRandomUUID).toHaveBeenCalled();
      expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', 'random-uuid');
    });

    it('given memoized fingerprint when calling again then returns cached value', async () => {
      mockGetItemAsync.mockResolvedValue('stored-fingerprint');

      const { getDeviceFingerprint } = require('../deviceFingerprint');

      // First call
      const result1 = await getDeviceFingerprint();
      // Second call should use memoized value
      const result2 = await getDeviceFingerprint();

      expect(result1).toBe('stored-fingerprint');
      expect(result2).toBe('stored-fingerprint');
      // SecureStore should only be called once
      expect(mockGetItemAsync).toHaveBeenCalledTimes(1);
    });

    it('given SecureStore read fails when getting then continues to generate', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Storage unavailable'));
      mockGetAndroidId.mockReturnValue('android-id');
      mockDigestStringAsync.mockResolvedValue('new-hash');
      mockSetItemAsync.mockResolvedValue(undefined);

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('new-hash');
    });

    it('given SecureStore write fails when storing then still returns fingerprint', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockGetAndroidId.mockReturnValue('android-id');
      mockDigestStringAsync.mockResolvedValue('new-hash');
      mockSetItemAsync.mockRejectedValue(new Error('Write failed'));

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('new-hash');
    });

    it('given Android getAndroidId throws when getting then falls back to UUID', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockGetAndroidId.mockImplementation(() => {
        throw new Error('Not available');
      });
      mockRandomUUID.mockReturnValue('fallback-uuid');
      mockDigestStringAsync.mockResolvedValue('uuid-hash');

      const { getDeviceFingerprint } = require('../deviceFingerprint');
      const result = await getDeviceFingerprint();

      expect(result).toBe('uuid-hash');
      expect(mockRandomUUID).toHaveBeenCalled();
    });
  });
});
