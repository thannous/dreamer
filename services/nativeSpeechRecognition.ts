import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

type NativeSpeechOptions = {
  onPartial?: (text: string) => void;
};

export type NativeSpeechSession = {
  stop: () => Promise<{ transcript: string; error?: string; recordedUri?: string | null }>;
  abort: () => void;
};

const END_TIMEOUT_MS = 4000;

const normalizeLocale = (locale: string) => locale.replace('_', '-').toLowerCase();

let cachedSpeechModule: ExpoSpeechRecognitionModuleType | null | undefined;

const getSpeechRecognitionModule = (): ExpoSpeechRecognitionModuleType | null => {
  if (cachedSpeechModule !== undefined) {
    return cachedSpeechModule;
  }

  const module = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>('ExpoSpeechRecognition');

  if (!module) {
    if (__DEV__) {
      console.warn('[nativeSpeech] ExpoSpeechRecognition native module unavailable');
      if (Platform.OS === 'web') {
        console.warn('[nativeSpeech] Web Speech API not available in this browser/context');
      }
    }
    cachedSpeechModule = null;
    return null;
  }

  cachedSpeechModule = module;
  return module;
};

async function shouldRequireOnDeviceRecognition(
  speechModule: ExpoSpeechRecognitionModuleType,
  languageCode: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (__DEV__) {
      console.log('[nativeSpeech] web platform, on-device not applicable');
    }
    return false;
  }

  if (!speechModule.supportsOnDeviceRecognition?.()) {
    return false;
  }

  try {
    const supportedLocales = await speechModule.getSupportedLocales?.({});
    const installedLocales = supportedLocales?.installedLocales ?? [];

    if (!installedLocales.length) {
      if (__DEV__) {
        console.log('[nativeSpeech] no installed locales, skipping on-device');
      }
      return false;
    }

    const normalizedLanguage = normalizeLocale(languageCode);
    if (__DEV__) {
      console.log('[nativeSpeech] installedLocales', installedLocales);
    }
    return installedLocales.some((locale) => normalizeLocale(locale) === normalizedLanguage);
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to determine on-device support', error);
    }
    return false;
  }
}

export async function startNativeSpeechSession(
  languageCode: string,
  options?: NativeSpeechOptions
): Promise<NativeSpeechSession | null> {
  const speechModule = getSpeechRecognitionModule();
  if (!speechModule) {
    if (__DEV__) {
      console.warn('[nativeSpeech] no module, cannot start session');
    }
    return null;
  }

  try {
    const available = speechModule.isRecognitionAvailable();
    if (!available) {
      if (__DEV__) {
        console.warn('[nativeSpeech] recognition unavailable', { platform: Platform.OS });
      }
      return null;
    }

    const permissions = await speechModule.requestPermissionsAsync();
    if (!permissions.granted) {
      if (__DEV__) {
        console.warn('[nativeSpeech] permissions not granted', permissions);
      }
      return null;
    }

    let ended = false;
    let lastPartial = '';
    let lastError: { code?: string; message?: string } | null = null;
    const finalChunks: string[] = [];
    let recordedUri: string | null = null;

    let resolveEnd: (() => void) | null = null;
    const endPromise = new Promise<void>((resolve) => {
      resolveEnd = () => {
        ended = true;
        resolve();
      };
    });

    const resultSub = speechModule.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript?.trim();
      if (__DEV__) {
        console.log('[nativeSpeech] result', { isFinal: event.isFinal, transcript });
      }
      if (!transcript) {
        return;
      }

      if (event.isFinal) {
        finalChunks.push(transcript);
        lastPartial = '';
      } else {
        lastPartial = transcript;
      }

      const preview = `${finalChunks.join(' ')} ${lastPartial}`.trim();
      if (preview && options?.onPartial) {
        options.onPartial(preview);
      }
    });

    const endSub = speechModule.addListener('end', () => {
      if (__DEV__) {
        console.log('[nativeSpeech] end');
      }
      resolveEnd?.();
    });

    const audioEndSub = speechModule.addListener('audioend', (event: { uri?: string | null }) => {
      if (__DEV__) {
        console.log('[nativeSpeech] audioend', event);
      }
      recordedUri = event?.uri ?? null;
    });

    const errorSub = speechModule.addListener('error', (event) => {
      console.warn('[nativeSpeech] error', event);
      lastError = { code: event.error, message: event.message };
      resolveEnd?.();
    });

    const requiresOnDeviceRecognition = await shouldRequireOnDeviceRecognition(speechModule, languageCode);
    if (__DEV__) {
      const service = speechModule.getDefaultRecognitionService?.();
      const supportsOnDevice = speechModule.supportsOnDeviceRecognition?.();
      console.log('[nativeSpeech] start', {
        languageCode,
        service,
        supportsOnDevice,
        requiresOnDeviceRecognition,
      });
    }

    speechModule.start({
      lang: languageCode,
      interimResults: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition,
      recordingOptions: speechModule.supportsRecording?.()
        ? {
            persist: true,
            outputSampleRate: 16000,
            outputEncoding: 'pcmFormatInt16',
          }
        : undefined,
    });

    const cleanup = () => {
      resolveEnd = null;
      resultSub.remove();
      endSub.remove();
      audioEndSub.remove();
      errorSub.remove();
    };

    const stop = async () => {
      if (!ended) {
        try {
          speechModule.stop();
        } catch {
          /* no-op */
        }
        await Promise.race([endPromise, new Promise((resolve) => setTimeout(resolve, END_TIMEOUT_MS))]);
      }

      cleanup();

      const transcript = (finalChunks.join(' ') || lastPartial).trim();
      if (__DEV__) {
        console.log('[nativeSpeech] stop result', {
          transcript,
          lastPartial,
          lastError,
          finalChunks,
          recordedUri,
        });
      }
      return { transcript, error: lastError?.message, recordedUri };
    };

    const abort = () => {
      if (!ended) {
        try {
          speechModule.abort();
        } catch {
          /* no-op */
        }
        resolveEnd?.();
      }
      cleanup();
    };

    return { stop, abort };
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to start', error);
    }
    return null;
  }
}
