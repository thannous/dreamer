import { beforeEach, describe, expect, it } from '@jest/globals';

const mockApplication = {
  nativeApplicationVersion: '3.0.1' as string | null,
  nativeBuildVersion: '42' as string | null,
};

const mockConstants = {
  expoConfig: {
    version: '3.0.0' as string | undefined,
    android: { versionCode: 38 },
    ios: { buildNumber: '38' },
  },
};

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockApplication.nativeApplicationVersion;
  },
  get nativeBuildVersion() {
    return mockApplication.nativeBuildVersion;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstants,
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const { getAppVersionString } = require('../appVersion');

describe('getAppVersionString', () => {
  beforeEach(() => {
    mockApplication.nativeApplicationVersion = '3.0.1';
    mockApplication.nativeBuildVersion = '42';
    mockConstants.expoConfig.version = '3.0.0';
  });

  it('uses the version and build number from the installed native binary', () => {
    expect(getAppVersionString()).toBe('3.0.1 (42)');
  });

  it('falls back to the Expo config outside a standalone binary', () => {
    mockApplication.nativeApplicationVersion = null;
    mockApplication.nativeBuildVersion = null;

    expect(getAppVersionString()).toBe('3.0.0 (38)');
  });

  it('supports the compact prefix used by the desktop sidebar', () => {
    expect(getAppVersionString({ prefix: 'v' })).toBe('v3.0.1 (42)');
  });

  it('returns null when no application version is available', () => {
    mockApplication.nativeApplicationVersion = null;
    mockConstants.expoConfig.version = undefined;

    expect(getAppVersionString()).toBeNull();
  });
});
