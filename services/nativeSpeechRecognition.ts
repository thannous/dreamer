import { Platform } from 'react-native';

import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

type NativeSpeechOptions = {
  onPartial?: (text: string) => void;
};

export type NativeSpeechSession = {
  stop: () => Promise<{
    transcript: string;
    error?: string;
    errorCode?: string;
    recordedUri?: string | null;
    hasRecording?: boolean;
  }>;
  abort: () => void;
  hasRecording?: boolean;
};

export const END_TIMEOUT_MS = 4000;

const normalizeLocale = (locale: string) => locale.replace('_', '-').toLowerCase();
const CHATGPT_RECOGNITION_SERVICE = 'com.openai.chatgpt';

const hasWebSpeechAPI = (): boolean => {
  return typeof window !== 'undefined' &&
    (typeof (window as typeof globalThis & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition !== 'undefined' ||
      typeof (window as typeof globalThis & { SpeechRecognition?: unknown }).SpeechRecognition !== 'undefined');
};

let cachedSpeechModule: ExpoSpeechRecognitionModuleType | null | undefined;

// Session token to prevent events from old sessions being processed
let globalSessionCounter = 0;

const normalizeChunk = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Calculate token-based similarity ratio between two normalized strings.
 * Returns a value between 0 and 1, where 1.0 means perfect match.
 * Used to detect when STT is replaying the entire transcript with corrections.
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const tokens1 = str1.split(' ');
  const tokens2 = str2.split(' ');
  const maxLen = Math.max(tokens1.length, tokens2.length);
  if (maxLen === 0) return 1.0;

  let matches = 0;
  const minLen = Math.min(tokens1.length, tokens2.length);
  for (let i = 0; i < minLen; i++) {
    if (tokens1[i] === tokens2[i]) matches++;
  }
  return matches / maxLen;
};

export type SpeechLocaleAvailability = {
  isInstalled: boolean;
  installedLocales: string[];
  androidRecognitionServicePackage?: string;
};

function resolveAndroidRecognitionServiceOverride(
  speechModule: ExpoSpeechRecognitionModuleType
): string | undefined {
  if (Platform.OS !== 'android') return undefined;

  try {
    const defaultService = speechModule.getDefaultRecognitionService?.()?.packageName ?? '';
    const isChatGptDefault = Boolean(defaultService) && defaultService === CHATGPT_RECOGNITION_SERVICE;

    const available = speechModule.getSpeechRecognitionServices?.() ?? [];
    const candidates = available.filter((pkg) => pkg && pkg !== CHATGPT_RECOGNITION_SERVICE);

    const preferred =
      candidates.find((pkg) => pkg === 'com.google.android.as') ??
      candidates.find((pkg) => pkg === 'com.google.android.googlequicksearchbox') ??
      candidates[0];

    // Only force a service when Android is configured to route recognition to ChatGPT,
    // which can rate-limit aggressively and break language switching.
    if (isChatGptDefault) {
      if (__DEV__) {
        console.log('[nativeSpeech] overriding Android recognition service', {
          defaultService,
          preferred,
          available,
        });
      }
      return preferred;
    }

    return undefined;
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to resolve Android recognition service override', error);
    }
    return undefined;
  }
}

async function ensureSpeechModuleInactive(speechModule: ExpoSpeechRecognitionModuleType): Promise<void> {
  if (!speechModule.getStateAsync) return;

  try {
    const state = await speechModule.getStateAsync();
    if (state === 'inactive') return;

    try {
      speechModule.abort();
    } catch {
      /* no-op */
    }

    const startTime = Date.now();
    while (Date.now() - startTime < 600) {
      const next = await speechModule.getStateAsync();
      if (next === 'inactive') return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch {
    /* no-op */
  }
}

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
 * STT engines often replay the entire transcript in partials with corrections.
 * This function uses fuzzy matching to detect replays and prefers the newer partial.
 *
 * Strategy:
 * 1. If partial is >80% similar to all finals → prefer partial (likely a replay with corrections)
 * 2. If partial clearly extends all finals → use partial alone
 * 3. If partial extends just the last final → replace last final with partial
 * 4. Otherwise → concatenate (fallback, may create duplicates but preserves content)
 */
export const buildPreview = (finalChunks: string[], lastPartial: string): string => {
  if (!lastPartial) {
    return finalChunks.join(' ').trim();
  }

  if (finalChunks.length === 0) {
    return lastPartial.trim();
  }

  const allFinalsJoined = finalChunks.join(' ');
  const normalizedAllFinals = normalizeChunk(allFinalsJoined);
  const normalizedPartial = normalizeChunk(lastPartial);

  // Case 1: Partial is very similar to finals (>80% tokens match)
  // This indicates STT is replaying the entire transcript with possible corrections
  const similarity = calculateSimilarity(normalizedAllFinals, normalizedPartial);
  if (similarity > 0.8) {
    if (__DEV__) {
      console.log('[buildPreview] case 1: prefer partial (replay detected)', {
        finalsCount: finalChunks.length,
        partialLength: lastPartial.length,
        similarity: similarity.toFixed(2),
      });
    }
    // Prefer partial (newer = more accurate)
    return lastPartial.trim();
  }

  // Case 2: Partial clearly extends all finals (starts with finals + more)
  if (normalizedPartial.length > normalizedAllFinals.length &&
      normalizedPartial.startsWith(normalizedAllFinals)) {
    if (__DEV__) {
      console.log('[buildPreview] case 2: partial extends all finals', {
        finalsCount: finalChunks.length,
        partialLength: lastPartial.length,
      });
    }
    return lastPartial.trim();
  }

  // Case 3: Partial extends just the last final chunk
  const lastFinal = finalChunks[finalChunks.length - 1] ?? '';
  const normalizedLastFinal = normalizeChunk(lastFinal);

  if (normalizedPartial.length > normalizedLastFinal.length &&
      normalizedPartial.startsWith(normalizedLastFinal)) {
    if (__DEV__) {
      console.log('[buildPreview] case 3: partial extends last final', {
        finalsCount: finalChunks.length,
        partialLength: lastPartial.length,
      });
    }
    const prefix = finalChunks.slice(0, -1).join(' ');
    return prefix ? `${prefix} ${lastPartial}`.trim() : lastPartial;
  }

  // Case 4: No clear relationship - concatenate
  // This might create duplicates, but at least we don't lose content
  if (__DEV__) {
    console.log('[buildPreview] case 4: no overlap, concatenating', {
      finalsCount: finalChunks.length,
      partialLength: lastPartial.length,
      similarity: similarity.toFixed(2),
    });
  }
  return `${allFinalsJoined} ${lastPartial}`.trim();
};

const loadSpeechRecognitionModule = async (): Promise<ExpoSpeechRecognitionModuleType | null> => {
  if (cachedSpeechModule !== undefined) {
    return cachedSpeechModule;
  }

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

export function __setCachedSpeechModuleForTests(
  module: ExpoSpeechRecognitionModuleType | null | undefined
) {
  cachedSpeechModule = module;
}

export async function getSpeechLocaleAvailability(languageCode: string): Promise<SpeechLocaleAvailability | null> {
  const speechModule = await loadSpeechRecognitionModule();
  if (!speechModule) return null;

  const androidRecognitionServicePackage = resolveAndroidRecognitionServiceOverride(speechModule);

  try {
    const supportedLocales = await speechModule.getSupportedLocales?.({ androidRecognitionServicePackage });
    const installedLocales = supportedLocales?.installedLocales ?? [];
    const normalizedLanguage = normalizeLocale(languageCode);
    const isInstalled = installedLocales.some((locale) => normalizeLocale(locale) === normalizedLanguage);

    return {
      isInstalled,
      installedLocales,
      androidRecognitionServicePackage,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to read supported locales', error);
    }
    return {
      isInstalled: false,
      installedLocales: [],
      androidRecognitionServicePackage,
    };
  }
}

export type OfflineModelPromptHandler = {
  show: (locale: string) => Promise<void>;
  isVisible: boolean;
};

let offlineModelPromptHandler: OfflineModelPromptHandler | null = null;

/**
 * Register the offline model prompt handler (wired once from a persistent UI host)
 * This allows services to trigger the UI without circular dependencies
 */
export function registerOfflineModelPromptHandler(handler: OfflineModelPromptHandler | null) {
  offlineModelPromptHandler = handler;
}

/**
 * Ensure offline STT model is available and trigger download if needed (Android 13+).
 * Returns true if the model is already installed or download was successful.
 * Returns false if offline recognition is not supported or download was cancelled.
 */
export async function ensureOfflineSttModel(locale: string): Promise<boolean> {
  // iOS and web don't support offline packs
  if (Platform.OS !== 'android') {
    if (__DEV__) {
      console.log('[nativeSpeech] offline model not available on this platform', { platform: Platform.OS });
    }
    return false;
  }

  // Android 13+ (API 33) needed for offline model download
  const androidApi = Number(Platform.Version);
  if (androidApi < 33) {
    if (__DEV__) {
      console.log('[nativeSpeech] offline models require Android 13+', { androidApi });
    }
    return false;
  }

  const speechModule = await loadSpeechRecognitionModule();
  if (!speechModule) return false;

  try {
    // Check if model is already installed
    const supported = await speechModule.getSupportedLocales?.({
      androidRecognitionServicePackage: 'com.google.android.as',
    });
    const installedLocales = supported?.installedLocales ?? [];

    if (installedLocales.includes(locale)) {
      if (__DEV__) {
        console.log('[nativeSpeech] offline model already installed', { locale });
      }
      return true;
    }

    // Model is missing - delegate to UI handler if available
    if (offlineModelPromptHandler) {
      await offlineModelPromptHandler.show(locale);
      // After prompt, check again if model was installed
      const supported2 = await speechModule.getSupportedLocales?.({
        androidRecognitionServicePackage: 'com.google.android.as',
      });
      const installedLocales2 = supported2?.installedLocales ?? [];
      return installedLocales2.includes(locale);
    }

    // Fallback: no UI handler registered (shouldn't happen in production)
    if (__DEV__) {
      console.warn('[nativeSpeech] no offline model prompt handler registered');
    }
    return false;
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to ensure offline model', { locale, error });
    }
    return false;
  }
}

async function shouldRequireOnDeviceRecognition(
  speechModule: ExpoSpeechRecognitionModuleType,
  languageCode: string,
  androidRecognitionServicePackage?: string
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
    // Check if the user has ensured the offline model is available via ensureOfflineSttModel()
    const supported = await speechModule.getSupportedLocales?.({ androidRecognitionServicePackage });
    const installedLocales = supported?.installedLocales ?? [];
    const normalizedLanguage = normalizeLocale(languageCode);
    const isInstalled = installedLocales.some((locale) => normalizeLocale(locale) === normalizedLanguage);

    if (__DEV__) {
      console.log('[nativeSpeech] on-device availability check', {
        languageCode,
        isInstalled,
        installedLocales: installedLocales.length,
        androidRecognitionServicePackage,
      });
    }

    // Only use on-device if the model is actually installed (after ensureOfflineSttModel)
    return isInstalled;
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to check on-device availability', error);
    }
    return false;
  }
}

export async function startNativeSpeechSession(
  languageCode: string,
  options?: NativeSpeechOptions
): Promise<NativeSpeechSession | null> {
  // Increment session counter to uniquely identify this session
  const sessionId = ++globalSessionCounter;

  if (__DEV__) {
    console.log('[nativeSpeech] session starting', { sessionId });
  }

  // Ensure the module is loaded asynchronously
  const speechModule = await loadSpeechRecognitionModule();
  if (!speechModule) {
    if (__DEV__) {
      console.warn('[nativeSpeech] no module, cannot start session', { sessionId });
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

    const androidRecognitionServicePackage = resolveAndroidRecognitionServiceOverride(speechModule);
    const requiresOnDeviceRecognition = await shouldRequireOnDeviceRecognition(
      speechModule,
      languageCode,
      androidRecognitionServicePackage
    );
    const supportsRecording = speechModule.supportsRecording?.() ?? false;
    if (__DEV__) {
      const service = speechModule.getDefaultRecognitionService?.();
      const supportsOnDevice = speechModule.supportsOnDeviceRecognition?.();
      console.log('[nativeSpeech] start', {
        languageCode,
        service,
        androidRecognitionServicePackage,
        supportsOnDevice,
        requiresOnDeviceRecognition,
        supportsRecording,
      });
    }

    await ensureSpeechModuleInactive(speechModule);

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
      // Ignore events from old sessions (race condition protection)
      if (sessionId !== globalSessionCounter) {
        if (__DEV__) {
          console.log('[nativeSpeech] ignoring result from old session', {
            sessionId,
            current: globalSessionCounter,
          });
        }
        return;
      }

      const transcript = event.results?.[0]?.transcript?.trim();
      if (!transcript) {
        return;
      }

      if (event.isFinal) {
        if (__DEV__) {
          console.log('[nativeSpeech] result', {
            sessionId,
            isFinal: event.isFinal,
            textLength: transcript.length,
            textSample: transcript.substring(0, 15) + '...',
          });
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
      // Ignore events from old sessions
      if (sessionId !== globalSessionCounter) {
        if (__DEV__) {
          console.log('[nativeSpeech] ignoring end from old session', { sessionId, current: globalSessionCounter });
        }
        return;
      }

      if (__DEV__) {
        console.log('[nativeSpeech] end', { sessionId });
      }
      resolveEnd?.();
    });

    const audioEndSub = speechModule.addListener('audioend', (event: { uri?: string | null }) => {
      // Ignore events from old sessions
      if (sessionId !== globalSessionCounter) {
        if (__DEV__) {
          console.log('[nativeSpeech] ignoring audioend from old session', { sessionId });
        }
        return;
      }

      if (__DEV__) {
        console.log('[nativeSpeech] audioend', { sessionId, hasUri: Boolean(event?.uri) });
      }
      recordedUri = event?.uri ?? null;
    });

    const errorSub = speechModule.addListener('error', (event) => {
      // Ignore events from old sessions
      if (sessionId !== globalSessionCounter) {
        if (__DEV__) {
          console.log('[nativeSpeech] ignoring error from old session', { sessionId });
        }
        return;
      }

      const isBenignClientError = event?.error === 'client';

      // Android can emit ERROR_CLIENT when we stop/abort; treat it as noise unless debugging.
      if (isBenignClientError) {
        if (__DEV__) {
          console.log('[nativeSpeech] client error ignored after stop/abort', { sessionId });
        }
        resolveEnd?.();
        return;
      }

      console.warn('[nativeSpeech] error', { sessionId, code: event?.error, message: event?.message });
      lastError = { code: event.error, message: event.message };
      resolveEnd?.();
    });

    speechModule.start({
      lang: languageCode,
      interimResults: true,
      addsPunctuation: true,
      // On web keep the session alive longer; native ignores/handles as supported.
      // This prevents premature stop before the user speaks.
      continuous: Platform.OS === 'web',
      requiresOnDeviceRecognition,
      androidRecognitionServicePackage,
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

      // Guaranteed cleanup: remove all listeners even if one fails
      try { resultSub.remove(); } catch {}
      try { endSub.remove(); } catch {}
      try { audioEndSub.remove(); } catch {}
      try { errorSub.remove(); } catch {}

      if (__DEV__) {
        console.log('[nativeSpeech] cleanup complete', { sessionId });
      }
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
      return {
        transcript,
        error: lastError?.message,
        errorCode: lastError?.code,
        recordedUri,
        hasRecording: supportsRecording,
      };
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
      cleanup(); // Always cleanup, even after errors
    };

    return { stop, abort, hasRecording: supportsRecording };
  } catch (error) {
    if (__DEV__) {
      console.warn('[nativeSpeech] failed to start', error);
    }
    return null;
  }
}
