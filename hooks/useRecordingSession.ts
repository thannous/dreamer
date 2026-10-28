import {
    AudioModule,
    setAudioModeAsync,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { createScopedLogger } from '@/lib/logger';
import { waitForPermissionActivityToSettle } from '@/lib/recordingPermissions';
import { holdMicrophone } from '@/services/microphoneHold';
import {
  getSpeechLocaleAvailability,
  isWebSpeechRecognitionAvailable,
  startNativeSpeechSession,
  type NativeSpeechSession,
} from '@/services/nativeSpeechRecognition';

const log = createScopedLogger('[useRecordingSession]');

type RecordingPermissionResult = {
  granted: boolean;
  prompted: boolean;
};

async function getOrRequestRecordingPermission(): Promise<RecordingPermissionResult> {
  try {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) {
      return { granted: true, prompted: false };
    }
  } catch (error) {
    log.warn('Failed to read recording permission before requesting it', error);
  }

  const requested = await AudioModule.requestRecordingPermissionsAsync();
  return { granted: requested.granted, prompted: true };
}

export type RecordingPermissionState = 'unknown' | 'granted' | 'denied';

export interface RecordingSessionResult {
  transcript: string;
  error?: string;
}

export interface UseRecordingSessionOptions {
  /** Locale for speech recognition (e.g., 'en-US', 'fr-FR') */
  transcriptionLocale: string;
  /** Translation function for error messages */
  t: (key: string, replacements?: Record<string, string | number>) => string;
  /** Callback when partial transcript is received */
  onPartialTranscript?: (text: string, context: { baseTranscript: string }) => void;
  /** Optional callback for language pack missing UI */
  onLanguagePackMissing?: (info: { locale: string; installedLocales: string[] }) => void;
  /** Called when native recognition ends without an explicit stop/abort. */
  onNativeEnd?: () => void;
}

export function useRecordingSession({
  transcriptionLocale,
  t,
  onPartialTranscript,
  onLanguagePackMissing,
  onNativeEnd,
}: UseRecordingSessionOptions) {
  const [isRecording, setIsRecording] = useState(false);
  // Held from a start's first audio mode change to its stop's last, with or without a
  // dictation session: the app's cues leave the audio session alone meanwhile.
  const microphoneRef = useRef<(() => void) | null>(null);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [recordingPermissionState, setRecordingPermissionState] =
    useState<RecordingPermissionState>('unknown');
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const isRecordingRef = useRef(false);
  // At unmount, a live recording hands the microphone back through the screen's forced
  // stop, once its teardown is over. A hold that nothing takes over goes back a turn later.
  useEffect(() => () => {
    const left = microphoneRef.current;
    if (!left) return;
    setTimeout(() => {
      if (microphoneRef.current !== left) return;
      microphoneRef.current = null;
      left();
    }, 0);
  }, []);
  const recordingTransitionRef = useRef(false);
  const stopPromiseRef = useRef<Promise<RecordingSessionResult> | null>(null);
  const hasAutoStoppedRecordingRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const pendingStartRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;
    AudioModule.getRecordingPermissionsAsync()
      .then((permission) => {
        if (!isMounted || !permission.granted) {
          return;
        }
        setRecordingPermissionState('granted');
      })
      .catch((error) => {
        log.warn('Failed to read recording permission status', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const forceStopRecording = useCallback(
    async (reason: 'blur' | 'unmount') => {
      pendingStartRef.current?.abort();
      const hasNativeSession = Boolean(nativeSessionRef.current);

      if (!hasNativeSession && !isRecordingRef.current) {
        return;
      }

      setIsRecording(false);
      setIsSpeechListening(false);
      isRecordingRef.current = false;
      const microphone = microphoneRef.current;
      microphoneRef.current = null;

      const nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;

      try {
        nativeSession?.abort();
      } catch (error) {
        log.warn('failed to abort native session during', reason, error);
      }

      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (error) {
        log.warn('failed to reset audio mode during', reason, error);
      } finally {
        microphone?.();
        hasAutoStoppedRecordingRef.current = false;
      }
    },
    []
  );

  const stopRecording = useCallback(async (): Promise<RecordingSessionResult> => {
    // A user pause also cancels a hands-free restart still awaiting native startup.
    pendingStartRef.current?.abort();
    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    const promise = (async (): Promise<RecordingSessionResult> => {
      let nativeSession: NativeSpeechSession | null = null;
      const microphone = microphoneRef.current;
      microphoneRef.current = null;

      try {
        setIsRecording(false);
        setIsSpeechListening(false);
        isRecordingRef.current = false;
        nativeSession = nativeSessionRef.current;
        nativeSessionRef.current = null;
        if (!nativeSession) return { transcript: '', error: 'stt_unavailable' };

        const nativeResult = await nativeSession.stop();
        const transcriptText = nativeResult.transcript?.trim() ?? '';
        const normalizedNativeError = nativeResult.error?.toLowerCase();
        const isLanguagePackMissing =
          normalizedNativeError?.includes('language-not-supported') ||
          normalizedNativeError?.includes('not yet downloaded') ||
          false;
        const isRateLimited =
          nativeResult.errorCode === 'too-many-requests' ||
          normalizedNativeError?.includes('too many requests') ||
          false;

        if (!transcriptText && isLanguagePackMissing) {
          const availability = await getSpeechLocaleAvailability(transcriptionLocale);
          const installedLocales = availability?.installedLocales ?? [];
          if (onLanguagePackMissing) {
            onLanguagePackMissing({ locale: transcriptionLocale, installedLocales });
          } else {
            const installedText = installedLocales.length
              ? installedLocales.join(', ')
              : t('recording.alert.language_pack_missing.none');
            Alert.alert(
              t('recording.alert.language_pack_missing.title'),
              t('recording.alert.language_pack_missing.message', {
                locale: transcriptionLocale,
                installed: installedText,
              })
            );
          }
          return { transcript: '', error: 'language_pack_missing' };
        }

        return {
          transcript: transcriptText,
          error: !transcriptText
            ? isRateLimited
              ? 'rate_limited'
              : 'no_speech'
            : undefined,
        };
      } catch (err) {
        nativeSession?.abort();
        log.error('Failed to stop recording', err);
        return { transcript: '', error: err instanceof Error ? err.message : 'stop_failed' };
      } finally {
        try {
          await setAudioModeAsync({ allowsRecording: false });
        } catch (err) {
          log.warn('Failed to reset audio mode after recording', err);
        }
        microphone?.();
        hasAutoStoppedRecordingRef.current = false;
      }
    })();

    stopPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      if (stopPromiseRef.current === promise) {
        stopPromiseRef.current = null;
      }
    }
  }, [onLanguagePackMissing, transcriptionLocale, t]);

  const startRecording = useCallback(
    async (currentTranscript: string): Promise<{ success: boolean; error?: string }> => {
      if (pendingStartRef.current) return { success: false, error: 'transition_in_progress' };
      const controller = new AbortController();
      pendingStartRef.current = controller;
      const checkCancelled = () => {
        if (controller.signal.aborted) throw new Error('cancelled');
      };
      let audioModeEnabled = false;
      let started = false;
      let microphone: (() => void) | null = null;
      setIsSpeechListening(false);

      try {
        if (Platform.OS === 'web') {
          const hasSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
          if (!hasSecureContext) {
            Alert.alert(
              t('recording.alert.permission_required.title'),
              t('recording.alert.insecure_context')
            );
            return { success: false, error: 'insecure_context' };
          }
          if (!isWebSpeechRecognitionAvailable()) {
            Alert.alert(
              t('recording.alert.stt_unavailable.title'),
              t('recording.alert.stt_unavailable.message')
            );
            return { success: false, error: 'stt_unavailable' };
          }
        } else {
          const { granted, prompted } = await getOrRequestRecordingPermission();
          checkCancelled();
          setRecordingPermissionState(granted ? 'granted' : 'denied');
          if (!granted) {
            Alert.alert(
              t('recording.alert.permission_required.title'),
              t('recording.alert.permission_required.message')
            );
            return { success: false, error: 'permission_denied' };
          }
          if (prompted) {
            await waitForPermissionActivityToSettle(controller.signal);
          }
        }

        checkCancelled();
        microphone = holdMicrophone();
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        audioModeEnabled = true;
        checkCancelled();

        nativeSessionRef.current?.abort();
        baseTranscriptRef.current = currentTranscript;

        const nativeSession = await startNativeSpeechSession(transcriptionLocale, {
          signal: controller.signal,
          onListeningChange: setIsSpeechListening,
          permissionAlreadyGranted: Platform.OS !== 'web',
          onEnd: onNativeEnd,
          onPartial: (text) => {
            onPartialTranscript?.(text, { baseTranscript: baseTranscriptRef.current });
          },
        });

        if (controller.signal.aborted) nativeSession?.abort();
        checkCancelled();
        nativeSessionRef.current = nativeSession;

        if (!nativeSessionRef.current) {
          if (Platform.OS === 'web') {
            Alert.alert(
              t('recording.alert.stt_unavailable.title'),
              t('recording.alert.stt_unavailable.message')
            );
          }
          await setAudioModeAsync({ allowsRecording: false });
          audioModeEnabled = false;
          return { success: false, error: 'stt_unavailable' };
        }

        if (__DEV__) {
          log.debug('native session', {
            hasSession: Boolean(nativeSessionRef.current),
            locale: transcriptionLocale,
          });
        }

        hasAutoStoppedRecordingRef.current = false;
        setIsRecording(true);
        isRecordingRef.current = true;
        microphoneRef.current?.();
        microphoneRef.current = microphone;
        started = true;
        return { success: true };
      } catch (err) {
        setIsSpeechListening(false);
        try {
          nativeSessionRef.current?.abort();
        } catch (abortError) {
          log.warn('Failed to abort native session after start failure', abortError);
        }
        nativeSessionRef.current = null;
        isRecordingRef.current = false;
        if (audioModeEnabled) {
          try {
            await setAudioModeAsync({ allowsRecording: false });
          } catch (resetError) {
            log.warn('Failed to reset audio mode after start failure', resetError);
          }
        }
        if (controller.signal.aborted) return { success: false, error: 'cancelled' };
        if (err instanceof Error && err.message === 'speech_permission_denied') {
          Alert.alert(
            t('recording.alert.permission_required.title'),
            t('recording.alert.speech_permission_required.message'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('recording.alert.open_settings'), onPress: () => {
                void Linking.openSettings().catch((error) => log.warn('Failed to open settings', error));
              } },
            ],
          );
          return { success: false, error: 'permission_denied' };
        }
        log.error('Failed to start recording', err);
        return { success: false, error: err instanceof Error ? err.message : 'start_failed' };
      } finally {
        if (!started) microphone?.();
        pendingStartRef.current = null;
      }
    },
    [t, transcriptionLocale, onNativeEnd, onPartialTranscript]
  );

  const toggleRecording = useCallback(
    async (currentTranscript: string): Promise<RecordingSessionResult | { success: boolean; error?: string }> => {
      if (recordingTransitionRef.current) {
        return { success: false, error: 'transition_in_progress' };
      }
      recordingTransitionRef.current = true;
      try {
        if (isRecordingRef.current) {
          return await stopRecording();
        } else {
          return await startRecording(currentTranscript);
        }
      } finally {
        recordingTransitionRef.current = false;
      }
    },
    [startRecording, stopRecording]
  );

  // Request microphone permissions on mount
  const requestPermissions = useCallback(async () => {
    const permission = await getOrRequestRecordingPermission();
    setRecordingPermissionState(permission.granted ? 'granted' : 'denied');
    if (!permission.granted) {
      Alert.alert(
        t('recording.alert.permission_required.title'),
        t('recording.alert.permission_required.message')
      );
    }
  }, [t]);

  // Handle app state changes (background/inactive)
  const setupAppStateListener = useCallback(() => {
    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      try {
        if ((state === 'background' || state === 'inactive') && isRecordingRef.current && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        log.warn('Failed to stop speech on app state change', error);
      }
    });

    return () => {
      subscription.remove();
      try {
        if (isRecordingRef.current && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        log.warn('Failed to stop speech during app state cleanup', error);
      }
    };
  }, [stopRecording]);

  return {
    isSpeechListening,
    isRecording,
    recordingPermissionState,
    isRecordingRef,
    baseTranscriptRef,
    startRecording,
    stopRecording,
    toggleRecording,
    forceStopRecording,
    requestPermissions,
    setupAppStateListener,
  };
}
