import { Platform } from 'react-native';

import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

type NativeSpeechOptions = {
  onPartial?: (text: string) => void;
};

export type NativeSpeechSession = {
  stop: () => Promise<{ transcript: string; error?: string; recordedUri?: string | null; hasRecording?: boolean }>;
  abort: () => void;
  hasRecording?: boolean;
};

export const END_TIMEOUT_MS = 4000;

const normalizeLocale = (locale: string) => locale.replace('_', '-').toLowerCase();

const hasWebSpeechAPI = (): boolean => {
  return typeof window !== 'undefined' &&
    (typeof (window as typeof globalThis & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition !== 'undefined' ||
      typeof (window as typeof globalThis & { SpeechRecognition?: unknown }).SpeechRecognition !== 'undefined');
};

let cachedSpeechModule: ExpoSpeechRecognitionModuleType | null | undefined;

const normalizeChunk = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Merge the latest final transcript chunk while avoiding duplicate concatenation.
 * - If the new chunk extends the last chunk (common STT behavior), replace it.
 * - If the new chunk is contained in the last chunk, keep the existing one.
 * - Otherwise, append the new chunk.
 */
export const mergeFinalChunk = (finalChunks: string[], newChunk: string): string[] => {
  const normalizedNew = normalizeChunk(newChunk);
  if (!normalizedNew) return finalChunks;

  const last = finalChunks[finalChunks.length - 1];
  if (!last) return [newChunk];

  const normalizedLast = normalizeChunk(last);

  // If identical, keep the existing chunk to avoid bouncing case/spacing.
  if (normalizedNew === normalizedLast) {
    return finalChunks;
  }

  // STT often replays the full transcript with new words appended.
  if (normalizedNew.startsWith(normalizedLast)) {
    const next = [...finalChunks];
    next[next.length - 1] = newChunk;
    return next;
  }

  // If the new chunk is shorter, keep the existing one to prevent duplication.
  if (normalizedLast.startsWith(normalizedNew)) {
    return finalChunks;
  }

  return [...finalChunks, newChunk];
};

/**
 * Build the preview string from final chunks and current partial, avoiding duplication.
 * STT engines often replay the entire sentence in partials (e.g., after a final is emitted,
 * the next partial may contain the full sentence plus new words). This function detects
 * when the partial extends the last final chunk and avoids concatenating duplicates.
 */
export const buildPreview = (finalChunks: string[], lastPartial: string): string => {
  const lastFinal = finalChunks[finalChunks.length - 1] ?? '';
  const normalizedLastFinal = normalizeChunk(lastFinal);
  const normalizedPartial = normalizeChunk(lastPartial);

  if (normalizedPartial && normalizedLastFinal && normalizedPartial.startsWith(normalizedLastFinal)) {
    // The partial extends the last final chunk - use partial instead of concatenating
    const prefix = finalChunks.slice(0, -1).join(' ');
    return prefix ? `${prefix} ${lastPartial}`.trim() : lastPartial;
  }

  return `${finalChunks.join(' ')} ${lastPartial}`.trim();
};

const loadSpeechRecognitionModule = async (): Promise<ExpoSpeechRecognitionModuleType | null> => {
  try {
    // Use dynamic import for ES6 compatibility
    const speechModule = await import('expo-speech-recognition');
    
    if (!speechModule.ExpoSpeechRecognitionModule) {
      throw new Error('ExpoSpeechRecognitionModule export missing');
    }

    cachedSpeechModule = speechModule.ExpoSpeechRecognitionModule;

    if (__DEV__ && Platform.OS === 'web') {
      console.log('[nativeSpeech] resolved ExpoSpeechRecognitionModule', {
        hasSpeechAPI: hasWebSpeechAPI(),
        hasStart: typeof speechModule.ExpoSpeechRecognitionModule.start === 'function',
      });
    }

    return cachedSpeechModule;
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] ExpoSpeechRecognition native module unavailable', {
        error,
        platform: Platform.OS,
        hasSpeechAPI: hasWebSpeechAPI(),
      });
      if (Platform.OS === 'web' && !hasWebSpeechAPI()) {
        console.warn('[nativeSpeech] Web Speech API not available in this browser/context');
      }
    }
    cachedSpeechModule = null;
    return null;
  }
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
  // Ensure the module is loaded asynchronously
  const speechModule = await loadSpeechRecognitionModule();
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

    // Web doesn't need (or support) permission requests; avoid noisy warnings
    const permissions = Platform.OS === 'web'
      ? { granted: hasWebSpeechAPI() }
      : await speechModule.requestPermissionsAsync();
    if (!permissions.granted) {
      if (__DEV__) {
        console.warn('[nativeSpeech] permissions not granted', permissions);
      }
      return null;
    }

    let ended = false;
    let lastPartial = '';
    let lastError: { code?: string; message?: string } | null = null;
    let finalChunks: string[] = [];
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
      if (!transcript) {
        return;
      }

      if (event.isFinal) {
        if (__DEV__) {
          console.log('[nativeSpeech] result', { isFinal: event.isFinal, transcript });
        }
        finalChunks = mergeFinalChunk(finalChunks, transcript);
        lastPartial = '';
      } else {
        lastPartial = transcript;
      }

      const preview = buildPreview(finalChunks, lastPartial);
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
      const isBenignClientError = event?.error === 'client';

      // Android can emit ERROR_CLIENT when we stop/abort; treat it as noise unless debugging.
      if (isBenignClientError) {
        if (__DEV__) {
          console.log('[nativeSpeech] client error ignored after stop/abort', event);
        }
        resolveEnd?.();
        return;
      }

      console.warn('[nativeSpeech] error', event);
      lastError = { code: event.error, message: event.message };
      resolveEnd?.();
    });

    const requiresOnDeviceRecognition = await shouldRequireOnDeviceRecognition(speechModule, languageCode);
    const supportsRecording = speechModule.supportsRecording?.() ?? false;
    if (__DEV__) {
      const service = speechModule.getDefaultRecognitionService?.();
      const supportsOnDevice = speechModule.supportsOnDeviceRecognition?.();
      console.log('[nativeSpeech] start', {
        languageCode,
        service,
        supportsOnDevice,
        requiresOnDeviceRecognition,
        supportsRecording,
      });
    }

    speechModule.start({
      lang: languageCode,
      interimResults: true,
      addsPunctuation: true,
      // On web keep the session alive longer; native ignores/handles as supported.
      // This prevents premature stop before the user speaks.
       
      continuous: Platform.OS === 'web',
      requiresOnDeviceRecognition,
      recordingOptions: supportsRecording
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
      return { transcript, error: lastError?.message, recordedUri, hasRecording: supportsRecording };
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

    return { stop, abort, hasRecording: supportsRecording };
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to start', error);
    }
    return null;
  }
}
