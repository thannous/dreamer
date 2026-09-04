import type { ExpoConfig } from 'expo/config';
import resolveExpoConfig, {
  DREAMER_QA_ANDROID_PACKAGE,
  DREAMER_QA_APP_NAME,
  DREAMER_QA_BUILD_ENV,
  DREAMER_QA_IOS_BUNDLE_IDENTIFIER,
  DREAMER_QA_SCHEME,
  createDreamerQaExpoConfig,
  parseDreamerQaBuildMarker,
  resolveDreamerQaBuildEnabled,
} from '../app.config';

const appJson = require('../app.json') as { expo: ExpoConfig };

const MARKERS = [
  DREAMER_QA_BUILD_ENV,
  'NOCTALIA_APP_VARIANT',
  'EXPO_PUBLIC_APP_VARIANT',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
];

function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => void
) {
  const previous: Record<string, string | undefined> = {};
  for (const key of MARKERS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    run();
  } finally {
    for (const key of MARKERS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function baseExpo(): ExpoConfig {
  return structuredClone(appJson.expo);
}

describe('Dreamer QA Expo identity', () => {
  it('accepts only unset, 0, or 1 for the native QA marker', () => {
    expect(parseDreamerQaBuildMarker(undefined)).toBe(false);
    expect(parseDreamerQaBuildMarker('')).toBe(false);
    expect(parseDreamerQaBuildMarker('0')).toBe(false);
    expect(parseDreamerQaBuildMarker('1')).toBe(true);
    expect(() => parseDreamerQaBuildMarker('true')).toThrow(
      `Unsupported ${DREAMER_QA_BUILD_ENV}`
    );
    expect(() => parseDreamerQaBuildMarker('lucid')).toThrow(
      `Unsupported ${DREAMER_QA_BUILD_ENV}`
    );
  });

  it('keeps production Expo config byte-identical when the marker is unset', () => {
    const config = baseExpo();
    const original = structuredClone(config);
    withEnv({}, () => {
      expect(resolveDreamerQaBuildEnabled()).toBe(false);
      expect(resolveExpoConfig({ config } as never)).toBe(config);
      expect(config).toEqual(original);
      expect(config.android?.package).toBe('com.tanuki75.noctalia');
      expect(config.ios?.bundleIdentifier).toBe('com.tanuki75.noctalia');
      expect(config.ios?.associatedDomains).toEqual(['applinks:dream.noctalia.app']);
      expect(config.android?.intentFilters).toEqual(original.android?.intentFilters);
      expect(config.updates).toEqual(original.updates);
      expect(config.extra?.eas).toEqual(original.extra?.eas);
    });
    withEnv({ [DREAMER_QA_BUILD_ENV]: '0' }, () => {
      expect(resolveExpoConfig({ config } as never)).toBe(config);
      expect(config).toEqual(original);
    });
  });

  it('isolates QA identity without inheriting production store or OTA bindings', () => {
    const config = baseExpo();
    const original = structuredClone(config);
    const qaConfig = createDreamerQaExpoConfig(config);

    expect(config).toEqual(original);
    expect(qaConfig).toMatchObject({
      name: DREAMER_QA_APP_NAME,
      slug: 'noctalia',
      scheme: DREAMER_QA_SCHEME,
      android: {
        package: DREAMER_QA_ANDROID_PACKAGE,
        versionCode: config.android?.versionCode,
        intentFilters: [],
      },
      ios: {
        bundleIdentifier: DREAMER_QA_IOS_BUNDLE_IDENTIFIER,
        associatedDomains: [],
      },
      plugins: config.plugins,
    });
    expect(qaConfig.updates).toBeUndefined();
    expect(qaConfig.extra?.eas).toBeUndefined();
    expect(qaConfig.extra?.apiUrl).toBe(config.extra?.apiUrl);
    expect(qaConfig.extra?.supabaseUrl).toBe(config.extra?.supabaseUrl);
    expect(qaConfig.extra?.revenuecatAndroidKey).toBe(
      config.extra?.revenuecatAndroidKey
    );

    withEnv({ [DREAMER_QA_BUILD_ENV]: '1' }, () => {
      const resolved = resolveExpoConfig({ config } as never);
      expect(resolved).not.toBe(config);
      expect(config).toEqual(original);
      expect(resolved.android?.package).toBe(DREAMER_QA_ANDROID_PACKAGE);
      expect(resolved.ios?.bundleIdentifier).toBe(DREAMER_QA_IOS_BUNDLE_IDENTIFIER);
      expect(resolved.ios?.associatedDomains).toEqual([]);
      expect(resolved.android?.intentFilters).toEqual([]);
      expect(resolved.updates).toBeUndefined();
      expect(resolved.extra?.eas).toBeUndefined();
      expect(resolved.extra?.apiUrl).toBe(config.extra?.apiUrl);
      expect(resolved.name).toBe(DREAMER_QA_APP_NAME);
      expect(resolved.scheme).toBe(DREAMER_QA_SCHEME);
    });
  });

  it('rejects combining Dreamer QA with Lucid Trainer', () => {
    const config = baseExpo();
    withEnv(
      {
        [DREAMER_QA_BUILD_ENV]: '1',
        NOCTALIA_APP_VARIANT: 'lucid',
        EXPO_PUBLIC_APP_VARIANT: 'lucid',
      },
      () => {
        expect(() => resolveExpoConfig({ config } as never)).toThrow(
          'cannot be combined with Lucid Trainer'
        );
      }
    );
  });
});
