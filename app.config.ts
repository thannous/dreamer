import type { ConfigContext, ExpoConfig } from 'expo/config';

const LUCID_APP_VERSION = '1.0.0';

function isLucidNativeMarker(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'noctalia') return false;
  if (value === 'lucid') return true;
  throw new Error(`[app.config] Unsupported NOCTALIA_APP_VARIANT: ${value}`);
}

function isLucidPublicMarker(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'noctalia') return false;
  if (value === 'lucid' || value === 'lucid-trainer') return true;
  throw new Error(`[app.config] Unsupported EXPO_PUBLIC_APP_VARIANT: ${value}`);
}

function resolveLucidBuildEnabled(): boolean {
  const nativeMarker = process.env.NOCTALIA_APP_VARIANT;
  const publicMarker = process.env.EXPO_PUBLIC_APP_VARIANT;
  const nativeLucid = isLucidNativeMarker(nativeMarker);
  const publicLucid = isLucidPublicMarker(publicMarker);

  if (nativeLucid !== publicLucid) {
    throw new Error(
      '[app.config] Partial Lucid Trainer configuration: ' +
        'NOCTALIA_APP_VARIANT and EXPO_PUBLIC_APP_VARIANT must both select Lucid ' +
        `(received native=${nativeMarker ?? '<unset>'}, public=${publicMarker ?? '<unset>'}).`
    );
  }

  return nativeLucid;
}

function resolveLucidGooglePlugin(): NonNullable<ExpoConfig['plugins']> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

  if (Boolean(webClientId) !== Boolean(iosClientId)) {
    throw new Error(
      '[app.config] Partial Lucid Trainer Google configuration: ' +
        'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ' +
        'must either both be configured or both be omitted.'
    );
  }

  if (!webClientId || !iosClientId) return [];

  const match = iosClientId.match(/^(.+)\.apps\.googleusercontent\.com$/);
  if (!match?.[1]) {
    throw new Error(
      '[app.config] Invalid EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID for Lucid Trainer.'
    );
  }

  return [
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: `com.googleusercontent.apps.${match[1]}` },
    ],
  ];
}

function createLucidExpoConfig(baseExpo: ExpoConfig): ExpoConfig {
  const lucidIcon = './assets/lucid/images/lucid-trainer-icon.png';
  const companionPlugins = (baseExpo.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return (
      name !== 'expo-audio' &&
      name !== 'expo-notifications' &&
      name !== 'expo-splash-screen' &&
      name !== 'expo-speech-recognition' &&
      name !== '@react-native-google-signin/google-signin' &&
      name !== './plugins/withDisableNotificationsBootActions'
    );
  });
  const lucidGooglePlugins = resolveLucidGooglePlugin();
  const lucidCueSounds = [
    './assets/lucid/audio/lucid_cue_rain_very_low.wav',
    './assets/lucid/audio/lucid_cue_rain_low.wav',
    './assets/lucid/audio/lucid_cue_rain.wav',
    './assets/lucid/audio/lucid_cue_ocean_very_low.wav',
    './assets/lucid/audio/lucid_cue_ocean_low.wav',
    './assets/lucid/audio/lucid_cue_ocean.wav',
    './assets/lucid/audio/lucid_cue_brown_noise_very_low.wav',
    './assets/lucid/audio/lucid_cue_brown_noise_low.wav',
    './assets/lucid/audio/lucid_cue_brown_noise.wav',
  ];
  const {
    NSMicrophoneUsageDescription: _microphoneUsageDescription,
    NSSpeechRecognitionUsageDescription: _speechRecognitionUsageDescription,
    ...lucidInfoPlist
  } = baseExpo.ios?.infoPlist ?? {};

  return {
    ...baseExpo,
    name: 'Noctalia Lucid Trainer',
    slug: 'noctalia-lucid-trainer',
    scheme: 'noctalia-lucid',
    icon: lucidIcon,
    // The companion is a new store application: it starts its own version
    // line instead of inheriting Noctalia's. EAS (appVersionSource=remote)
    // owns the build numbers after the first build.
    version: LUCID_APP_VERSION,
    runtimeVersion: LUCID_APP_VERSION,
    ios: {
      ...baseExpo.ios,
      bundleIdentifier: 'com.tanuki75.noctalia.lucid',
      buildNumber: '1',
      associatedDomains: ['applinks:lucid.noctalia.app'],
      infoPlist: {
        ...lucidInfoPlist,
        CADisableMinimumFrameDurationOnPhone: true,
        LSApplicationQueriesSchemes: ['noctalia'],
      },
    },
    android: {
      ...baseExpo.android,
      package: 'com.tanuki75.noctalia.lucid',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#201131',
        foregroundImage: lucidIcon,
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'lucid.noctalia.app', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      permissions: [],
      blockedPermissions: [
        ...(baseExpo.android?.blockedPermissions ?? []),
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      ...baseExpo.web,
      favicon: lucidIcon,
      name: 'Noctalia Lucid Trainer',
      shortName: 'Lucid Trainer',
      themeColor: '#070B18',
      backgroundColor: '#070B18',
    },
    plugins: [
      ...companionPlugins,
      [
        'expo-splash-screen',
        {
          image: lucidIcon,
          imageWidth: 220,
          resizeMode: 'contain',
          backgroundColor: '#201131',
          dark: { backgroundColor: '#201131' },
        },
      ],
      ['expo-audio', { microphonePermission: false, enableBackgroundPlayback: true }],
      ['expo-notifications', { sounds: lucidCueSounds }],
      './plugins/withLucidNoctaliaQueries',
      ...lucidGooglePlugins,
    ],
    extra: {
      ...baseExpo.extra,
      eas: undefined,
      product: 'lucid-trainer',
      // RevenueCat SDK keys identify a concrete store application. The
      // companion must receive its own public keys through its build profile;
      // inheriting Noctalia's app key would bind purchases to the wrong app.
      revenuecatAndroidKey: undefined,
      revenuecatIosKey: undefined,
      revenuecatWebKey: undefined,
    },
    updates: undefined,
  };
}

export default function resolveExpoConfig({ config }: ConfigContext): ExpoConfig {
  const baseExpo = config as ExpoConfig;

  if (resolveLucidBuildEnabled()) {
    return createLucidExpoConfig(baseExpo);
  }

  return baseExpo;
}
