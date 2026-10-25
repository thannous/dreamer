import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';
import { createClient } from '@supabase/supabase-js';
import resolveExpoConfig, {
  DREAMER_QA_ANDROID_PACKAGE,
  DREAMER_QA_APP_NAME,
  DREAMER_QA_BUILD_ENV,
  DREAMER_QA_IOS_BUNDLE_IDENTIFIER,
  DREAMER_QA_OBSERVE,
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
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EAS_BUILD_PROFILE',
  'EAS_BUILD',
  'EXPO_PUBLIC_NATIVE_QA_AUDIO',
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
  it('uses production App Attest only for App Store/TestFlight profiles', () => {
    const entitlement = 'com.apple.developer.devicecheck.appattest-environment';
    for (const profile of ['release', 'production', 'ai-internal']) {
      withEnv({ EAS_BUILD_PROFILE: profile }, () => {
        expect(resolveExpoConfig({ config: baseExpo() } as never).ios?.entitlements?.[entitlement])
          .toBe('production');
      });
    }
    for (const profile of ['development', 'preview', 'release-smoke']) {
      withEnv({ EAS_BUILD_PROFILE: profile }, () => {
        expect(resolveExpoConfig({ config: baseExpo() } as never).ios?.entitlements?.[entitlement])
          .toBe('development');
      });
    }
    for (const [profile, expected] of [
      ['lucid-preview', 'development'],
      ['lucid-production', 'production'],
    ] as const) {
      withEnv({
        NOCTALIA_APP_VARIANT: 'lucid',
        EXPO_PUBLIC_APP_VARIANT: 'lucid',
        EAS_BUILD_PROFILE: profile,
      }, () => {
        const config = resolveExpoConfig({ config: baseExpo() } as never);
        expect(config.ios?.bundleIdentifier).toBe('com.tanuki75.noctalia.lucid');
        expect(config.ios?.entitlements?.[entitlement]).toBe(expected);
      });
    }
  });
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
    const qaConfig = createDreamerQaExpoConfig(config, {});

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
    expect(qaConfig.updates).toEqual({ enabled: false });
    // Not the store app's EAS project: Observe starts, and reports nothing off the device.
    expect(qaConfig.extra?.eas).toEqual({
      projectId: DREAMER_QA_OBSERVE.projectId,
      observe: { endpointUrl: DREAMER_QA_OBSERVE.endpointUrl },
    });
    expect(qaConfig.extra?.eas?.projectId).not.toBe(config.extra?.eas?.projectId);
    expect(new URL(DREAMER_QA_OBSERVE.endpointUrl).hostname).toBe('127.0.0.1');
    expect(qaConfig.extra?.apiUrl).toBe('https://127.0.0.1:9');
    expect(qaConfig.extra?.supabaseUrl).toBe('https://127.0.0.1:9');
    expect(qaConfig.extra?.supabaseAnonKey).toBeUndefined();
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
      // Explicitly disable updates so the native Release receipt proves embedded JS.
      expect(resolved.updates).toEqual({ enabled: false });
      expect(resolved.extra?.eas?.projectId).toBe(DREAMER_QA_OBSERVE.projectId);
      expect(resolved.extra?.apiUrl).toBe('https://127.0.0.1:9');
      expect(resolved.name).toBe(DREAMER_QA_APP_NAME);
      expect(resolved.scheme).toBe(DREAMER_QA_SCHEME);
    });
  });

  // Build-time configuration is not a browser journey. A missing QA override
  // must never inherit a production backend from app.json; an explicit target
  // must remain usable without changing the normal app's configuration.
  it('uses only explicit QA backend settings and fails closed for blanks', () => {
    const base = baseExpo();
    const original = structuredClone(base);
    const explicit = createDreamerQaExpoConfig(base, {
      EXPO_PUBLIC_API_URL: ' https://qa-api.example.invalid ',
      EXPO_PUBLIC_SUPABASE_URL: ' https://qa-auth.example.invalid ',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: ' synthetic-qa-public-key ',
    });
    expect(explicit.extra).toMatchObject({
      apiUrl: 'https://qa-api.example.invalid',
      supabaseUrl: 'https://qa-auth.example.invalid',
      supabaseAnonKey: 'synthetic-qa-public-key',
    });
    const blank = createDreamerQaExpoConfig(base, {
      EXPO_PUBLIC_API_URL: ' ', EXPO_PUBLIC_SUPABASE_URL: ' ', EXPO_PUBLIC_SUPABASE_ANON_KEY: ' ',
    });
    expect(blank.extra).toMatchObject({
      apiUrl: 'https://127.0.0.1:9', supabaseUrl: 'https://127.0.0.1:9', supabaseAnonKey: undefined,
    });
    // Match the runtime's missing-key fallback with the real SDK constructor:
    // an empty string survives ?? and crashes before the QA app can start.
    expect(() => createClient(blank.extra!.supabaseUrl, blank.extra!.supabaseAnonKey ?? 'anon-key-not-set', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })).not.toThrow();
    expect(base).toEqual(original);
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

describe('product route roots', () => {
  it('selects the dedicated Lucid context without changing Journal configuration', () => {
    withEnv({}, () => {
      const base = baseExpo();
      expect(resolveExpoConfig({ config: base } as any).plugins).toEqual(base.plugins);
    });
    withEnv({ NOCTALIA_APP_VARIANT: 'lucid', EXPO_PUBLIC_APP_VARIANT: 'lucid-trainer' }, () => {
      const config = resolveExpoConfig({ config: baseExpo() } as any);
      expect(config.plugins?.filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-router'))
        .toEqual([['expo-router', { root: './routes/lucid' }]]);
      expect(config.plugins).not.toContain('./plugins/withAndroidR8Optimization');
    });
  });

  it('compiles the Siri dream action into the journal only', () => {
    // A Lucid build with it would let Siri confirm a dream that no journal reads.
    withEnv({}, () => {
      const config = resolveExpoConfig({ config: baseExpo() } as any);
      expect(config.plugins).toContain('expo-app-intents');
      expect(config.experiments?.inlineModules?.watchedDirectories).toEqual(['app-intents']);
    });
    withEnv({ NOCTALIA_APP_VARIANT: 'lucid', EXPO_PUBLIC_APP_VARIANT: 'lucid-trainer' }, () => {
      const config = resolveExpoConfig({ config: baseExpo() } as any);
      expect(config.plugins).not.toContain('expo-app-intents');
      expect(config.plugins).not.toContain('./plugins/withAppIntentsLocalizations');
      expect(config.experiments?.inlineModules).toBeUndefined();
      expect(config.experiments?.typedRoutes).toBe(true);
    });
  });

  it('gives the journal its iOS widgets and Lucid none', () => {
    // Lucid's widgets would open a capture screen and a journal it does not have.
    const pluginNames = (config: { plugins?: unknown[] }) =>
      (config.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    withEnv({}, () => {
      expect(pluginNames(resolveExpoConfig({ config: baseExpo() } as any))).toContain('expo-widgets');
    });
    withEnv({ NOCTALIA_APP_VARIANT: 'lucid', EXPO_PUBLIC_APP_VARIANT: 'lucid-trainer' }, () => {
      const names = pluginNames(resolveExpoConfig({ config: baseExpo() } as any));
      expect(names).not.toContain('expo-widgets');
      expect(names).not.toContain('./plugins/withWidgetGalleryStrings');
    });
  });

  it('names every widget in the gallery in each language of the app', () => {
    const plugins = (appJson.expo.plugins ?? []) as unknown[];
    const indexOf = (name: string) =>
      plugins.findIndex((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name);
    const widgets = plugins[indexOf('expo-widgets')] as [string, { widgets: { displayName: string; description: string }[] }];
    const strings = plugins[indexOf('./plugins/withWidgetGalleryStrings')] as [string, Record<string, Record<string, string>>];
    // Its mods must run after expo-widgets' own, which creates the extension target.
    expect(indexOf('./plugins/withWidgetGalleryStrings')).toBeLessThan(indexOf('expo-widgets'));
    const english = widgets[1].widgets.flatMap(({ displayName, description }) => [displayName, description]).sort();
    // The app's own languages (lib/i18n), English being the one app.json writes.
    const languages = readdirSync(join(__dirname, '../lib/i18n'))
      .filter((file) => /^[a-z]{2}\.ts$/.test(file) && file !== 'en.ts')
      .map((file) => file.slice(0, 2))
      .sort();
    expect(Object.keys(strings[1]).sort()).toEqual(languages);
    for (const translations of Object.values(strings[1])) {
      expect(Object.keys(translations).sort()).toEqual(english);
      expect(Object.values(translations).every((value) => value.trim() && !value.includes('—'))).toBe(true);
    }
  });
});

// The native journey runs only a valid local QA binary. These rejection cases
// cover accidental Store/cloud/remote configuration that cannot safely be
// exercised by that device journey.
describe('native speech QA build boundary', () => {
  const local = {
    NOCTALIA_DREAMER_QA_BUILD: '1', EXPO_PUBLIC_NATIVE_QA_AUDIO: 'true',
    EXPO_PUBLIC_API_URL: 'http://127.0.0.1:31284/functions/v1/api',
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:31284',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'owned-local-public-key',
  };
  it('enables fixture input and cleartext only for a local QA binary with OTA disabled', () => {
    withEnv(local, () => {
      const config = resolveExpoConfig({ config: baseExpo() } as never);
      expect(config.extra?.nativeQaAudio).toBe(true);
      expect(config.extra).toMatchObject({
        apiUrl: local.EXPO_PUBLIC_API_URL,
        supabaseUrl: local.EXPO_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: local.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        supabaseFunctionJwt: local.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        revenuecatAndroidKey: '', revenuecatIosKey: '', revenuecatWebKey: '',
      });
      expect(config.updates).toEqual({ enabled: false });
      expect(config.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsLocalNetworking).toBe(true);
      const build = config.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
      expect(Array.isArray(build) && build[1]?.android.usesCleartextTraffic).toBe(true);
    });
  });
  it('applies speech safety checks to the injected environment', () => {
    // A config caller may supply an environment independently of process.env.
    // Reading the marker or guards from different sources can bypass local-only QA.
    withEnv({}, () => {
      const config = createDreamerQaExpoConfig(baseExpo(), local);
      expect(config.extra).toMatchObject({ nativeQaAudio: true,
        apiUrl: local.EXPO_PUBLIC_API_URL, supabaseFunctionJwt: local.EXPO_PUBLIC_SUPABASE_ANON_KEY });
      expect(() => createDreamerQaExpoConfig(baseExpo(), { ...local, EAS_BUILD: 'true' })).toThrow('local-only');
      expect(() => createDreamerQaExpoConfig(baseExpo(), {
        ...local, EXPO_PUBLIC_API_URL: 'https://production.example.invalid',
      })).toThrow('loopback');
    });
  });
  it.each([
    { NOCTALIA_DREAMER_QA_BUILD: '0' },
    { EAS_BUILD: 'true' },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: '' },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' },
    { EXPO_PUBLIC_API_URL: 'https://noctalia.app/api' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://production.supabase.co' },
    { EXPO_PUBLIC_API_URL: 'http://localhost.example.com/api' },
    { EXPO_PUBLIC_API_URL: 'http://user:password@127.0.0.1/api' },
  ])('rejects an unsafe speech QA build %j', overrides => {
    withEnv({ ...local, ...overrides }, () => {
      expect(() => resolveExpoConfig({ config: baseExpo() } as never)).toThrow();
    });
  });
});
