/**
 * Resolves what kind of voice dictation a device can actually deliver.
 *
 * The app must let users dictate a dream on every supported Android version.
 * `android.speech` exposes its features at three different API levels, and the
 * lower ones simply return less information rather than failing:
 *
 * - API 31 (`S`)        — `isOnDeviceRecognitionAvailable` / `createOnDeviceSpeechRecognizer`
 * - API 33 (`TIRAMISU`) — `checkRecognitionSupport`, which is what backs
 *                         `getSupportedLocales`; below it the installed-locale
 *                         list is empty, not wrong.
 *
 * So below API 33 we cannot prove a locale is installed locally, and we must
 * degrade to a recognizer that can reach the network instead of guessing.
 * The ladder below never blocks dictation because of an API level — it only
 * blocks when the device genuinely cannot capture audio at all.
 */

/** `isOnDeviceRecognitionAvailable` / `createOnDeviceSpeechRecognizer`. */
export const ON_DEVICE_RECOGNITION_MIN_API = 31;

/** `checkRecognitionSupport`, which backs installed-locale introspection. */
export const LOCALE_INTROSPECTION_MIN_API = 33;

export type SpeechCapabilityTier =
  /** Native recognizer, requested locale installed locally: works offline. */
  | 'on_device'
  /** Native recognizer, locale not proven local: recognizer may use the network. */
  | 'network'
  /** No native recognizer: record audio and transcribe it server-side. */
  | 'server_only'
  /** No way to capture speech at all: the voice control must be hidden. */
  | 'unavailable';

export type SpeechCapabilityReason =
  | 'locale_installed'
  | 'locale_not_installed'
  | 'locale_introspection_unavailable'
  | 'on_device_unsupported'
  | 'no_recognition_service'
  | 'no_microphone';

export type SpeechCapabilityInput = {
  platform: 'android' | 'ios' | 'web';
  /** `Platform.Version` on Android, `null` elsewhere. */
  androidApiLevel: number | null;
  /** `SpeechRecognizer.isRecognitionAvailable()` via the native module. */
  recognitionAvailable: boolean;
  /** `SpeechRecognizer.isOnDeviceRecognitionAvailable()`, already API-gated natively. */
  onDeviceRecognitionSupported: boolean;
  /** Empty below API 33 — absence is not proof that nothing is installed. */
  installedLocales: string[];
  requestedLocale: string;
  /** Transcription locales the app itself ships (see `APP_TRANSCRIPTION_LOCALES`). */
  appLocales: readonly string[];
  /** False only once the recorder has proven the device has no usable microphone. */
  canRecordAudio: boolean;
};

export type SpeechCapability = {
  tier: SpeechCapabilityTier;
  reason: SpeechCapabilityReason;
  /** Passed straight to `expo-speech-recognition`'s `requiresOnDeviceRecognition`. */
  requiresOnDeviceRecognition: boolean;
  /**
   * App languages the user already has installed locally, minus the requested
   * one. Offered as an explicit choice — never substituted silently, because
   * recognizing French audio with an English model produces confident garbage.
   */
  localAlternatives: string[];
};

export const normalizeSpeechLocale = (locale: string): string =>
  locale.replace('_', '-').toLowerCase();

/** Dictation is possible in some form. */
export const canDictate = (capability: SpeechCapability): boolean =>
  capability.tier !== 'unavailable';

/** Dictation completes without leaving the device. */
export const isFullyOffline = (capability: SpeechCapability): boolean =>
  capability.tier === 'on_device';

/**
 * The recognizer may send audio to a remote service. Callers use this to keep
 * the privacy notice honest — `createSpeechRecognizer()` picks the system
 * default, which is usually but not always remote.
 */
export const mayLeaveDevice = (capability: SpeechCapability): boolean =>
  capability.tier === 'network' || capability.tier === 'server_only';

export function resolveSpeechCapability(input: SpeechCapabilityInput): SpeechCapability {
  const requested = normalizeSpeechLocale(input.requestedLocale);
  const installed = input.installedLocales.map(normalizeSpeechLocale);

  const localAlternatives = input.appLocales.filter((locale) => {
    const normalized = normalizeSpeechLocale(locale);
    return normalized !== requested && installed.includes(normalized);
  });

  // Nothing can capture audio: this is the only case that blocks the feature.
  if (!input.canRecordAudio) {
    return {
      tier: 'unavailable',
      reason: 'no_microphone',
      requiresOnDeviceRecognition: false,
      localAlternatives: [],
    };
  }

  // No RecognitionService installed (common on ROMs without Google services).
  // We can still record and transcribe server-side, so dictation survives.
  if (!input.recognitionAvailable) {
    return {
      tier: 'server_only',
      reason: 'no_recognition_service',
      requiresOnDeviceRecognition: false,
      localAlternatives,
    };
  }

  const androidBelow = (minApi: number) =>
    input.platform === 'android' &&
    input.androidApiLevel !== null &&
    input.androidApiLevel < minApi;

  // Below API 31 the on-device factory does not exist; below API 33 we cannot
  // read the installed-locale list, so we cannot prove offline recognition
  // would succeed. Forcing it would throw or silently fail — use the default
  // recognizer, which falls back to the network.
  if (androidBelow(ON_DEVICE_RECOGNITION_MIN_API) || !input.onDeviceRecognitionSupported) {
    return {
      tier: 'network',
      reason: 'on_device_unsupported',
      requiresOnDeviceRecognition: false,
      localAlternatives,
    };
  }

  if (androidBelow(LOCALE_INTROSPECTION_MIN_API)) {
    return {
      tier: 'network',
      reason: 'locale_introspection_unavailable',
      requiresOnDeviceRecognition: false,
      localAlternatives,
    };
  }

  if (installed.includes(requested)) {
    return {
      tier: 'on_device',
      reason: 'locale_installed',
      requiresOnDeviceRecognition: true,
      localAlternatives,
    };
  }

  return {
    tier: 'network',
    reason: 'locale_not_installed',
    requiresOnDeviceRecognition: false,
    localAlternatives,
  };
}
