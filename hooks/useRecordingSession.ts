import {
    AudioModule,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { createScopedLogger } from '@/lib/logger';
import { handleRecorderReleaseError, RECORDING_OPTIONS } from '@/lib/recording';
import {
  getSpeechLocaleAvailability,
  startNativeSpeechSession,
  type NativeSpeechSession,
} from '@/services/nativeSpeechRecognition';
import { transcribeAudio } from '@/services/speechToText';

const log = createScopedLogger('[useRecordingSession]');

export interface RecordingSessionResult {
  transcript: string;
  error?: string;
  recordedUri?: string | null;
}

export interface UseRecordingSessionOptions {
  /** Locale for speech recognition (e.g., 'en-US', 'fr-FR') */
  transcriptionLocale: string;
  /** Translation function for error messages */
  t: (key: string, params?: Record<string, unknown>) => string;
  /** Callback when partial transcript is received */
  onPartialTranscript?: (text: string) => void;
  /** Callback when transcript limit is reached */
  onLimitReached?: () => void;
}

export function useRecordingSession({
  transcriptionLocale,
  t,
  onPartialTranscript,
  onLimitReached,
}: UseRecordingSessionOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const skipRecorderRef = useRef(false);
  const recorderReleasedRef = useRef(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const isRecordingRef = useRef(false);
  const recordingTransitionRef = useRef(false);
  const hasAutoStoppedRecordingRef = useRef(false);
  const baseTranscriptRef = useRef('');

  const handleRecorderError = useCallback(
    (context: string, error: unknown) => {
      const released = handleRecorderReleaseError(context, error);
      if (released) {
        recorderReleasedRef.current = true;
        isRecordingRef.current = false;
      }
      return released;
    },
    []
  );

  const getRecorderIsRecording = useCallback(() => {
    if (recorderReleasedRef.current) {
      return false;
    }
    return isRecordingRef.current;
  }, []);

  const forceStopRecording = useCallback(
    async (reason: 'blur' | 'unmount') => {
      const hasNativeSession = Boolean(nativeSessionRef.current);
      const recorderIsRecording = getRecorderIsRecording();
      const shouldStopRecorder = !skipRecorderRef.current && recorderIsRecording;

      if (!hasNativeSession && !shouldStopRecorder && !isRecordingRef.current) {
        return;
      }

      setIsRecording(false);
      isRecordingRef.current = false;

      const nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;

      try {
        nativeSession?.abort();
      } catch (error) {
        log.warn('failed to abort native session during', reason, error);
      }

      if (shouldStopRecorder && !recorderReleasedRef.current) {
        try {
          await audioRecorder.stop();
        } catch (error) {
          if (!handleRecorderError(`forceStopRecording:${reason}`, error)) {
            log.warn('failed to stop audio recorder during cleanup', error);
          }
        }
      }

      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (error) {
        log.warn('failed to reset audio mode during', reason, error);
      } finally {
        skipRecorderRef.current = false;
        hasAutoStoppedRecordingRef.current = false;
      }
    },
    [audioRecorder, getRecorderIsRecording, handleRecorderError]
  );

  const stopRecording = useCallback(async (): Promise<RecordingSessionResult> => {
    let nativeSession: NativeSpeechSession | null = null;
    let nativeResultPromise: Promise<{
      transcript: string;
      error?: string;
      errorCode?: string;
      recordedUri?: string | null;
      hasRecording?: boolean;
    }> | null = null;
    let nativeErrorCode: string | undefined;
    let nativeError: string | undefined;
    let isLanguagePackMissing = false;
    let isRateLimited = false;

    try {
      setIsRecording(false);
      isRecordingRef.current = false;
      nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;
      const usedRecorder = !skipRecorderRef.current;

      nativeResultPromise = nativeSession?.stop() ?? null;
      if (usedRecorder && !recorderReleasedRef.current) {
        try {
          await audioRecorder.stop();
        } catch (error) {
          if (!handleRecorderError('stopRecording', error)) {
            throw error;
          }
        }
      }
      const uri =
        usedRecorder && !recorderReleasedRef.current ? audioRecorder.uri ?? undefined : undefined;

      let transcriptText = '';
      let recordedUri: string | undefined;

      if (nativeResultPromise) {
        try {
          const nativeResult = await nativeResultPromise;
          log.debug('native result', nativeResult);
          transcriptText = nativeResult.transcript?.trim() ?? '';
          recordedUri = nativeResult.recordedUri ?? undefined;
          if (!transcriptText && nativeResult.error) {
            log.warn('Native STT returned empty result', nativeResult.error);
          }
          nativeError = nativeResult.error;
          nativeErrorCode = nativeResult.errorCode;
          const normalizedNativeError = nativeError?.toLowerCase();
          isLanguagePackMissing =
            normalizedNativeError?.includes('language-not-supported') ||
            normalizedNativeError?.includes('not yet downloaded') ||
            false;
          isRateLimited =
            nativeErrorCode === 'too-many-requests' ||
            normalizedNativeError?.includes('too many requests') ||
            false;
        } catch (error) {
          log.warn('Native STT failed', error);
        }
      } else {
        log.debug('no native session, will rely on backup', { uriPresent: Boolean(uri) });
      }

      const hasNativeSession = Boolean(nativeResultPromise);
      const shouldFallbackToGoogle =
        (isLanguagePackMissing || isRateLimited || !hasNativeSession) && !transcriptText && (uri || recordedUri);

      if (shouldFallbackToGoogle) {
        try {
          const fallbackUri = uri ?? recordedUri;
          log.debug('fallback to Google STT', {
            locale: transcriptionLocale,
            uriLength: fallbackUri?.length ?? 0,
          });
          transcriptText = await transcribeAudio({
            uri: fallbackUri!,
            languageCode: transcriptionLocale,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown transcription error';
          return { transcript: '', error: msg };
        }
      }

      if (!transcriptText && isLanguagePackMissing) {
        const availability = await getSpeechLocaleAvailability(transcriptionLocale);
        const installedText = availability?.installedLocales.length
          ? availability.installedLocales.join(', ')
          : t('recording.alert.language_pack_missing.none');
        Alert.alert(
          t('recording.alert.language_pack_missing.title'),
          t('recording.alert.language_pack_missing.message', {
            locale: transcriptionLocale,
            installed: installedText,
          })
        );
        return {
          transcript: '',
          recordedUri: recordedUri ?? uri,
          error: 'language_pack_missing',
        };
      }

      return {
        transcript: transcriptText,
        recordedUri: recordedUri ?? uri,
        error: !transcriptText && !uri && !hasNativeSession ? 'no_recording' : undefined,
      };
    } catch (err) {
      if (handleRecorderError('stopRecording', err)) {
        return { transcript: '', error: 'recorder_released' };
      }
      nativeSession?.abort();
      log.error('Failed to stop recording', err);
      return { transcript: '', error: err instanceof Error ? err.message : 'stop_failed' };
    } finally {
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (err) {
        log.warn('Failed to reset audio mode after recording', err);
      }
      hasAutoStoppedRecordingRef.current = false;
      skipRecorderRef.current = false;
    }
  }, [audioRecorder, transcriptionLocale, handleRecorderError, t]);

  const startRecording = useCallback(
    async (currentTranscript: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { granted } = await AudioModule.requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert(
            t('recording.alert.permission_required.title'),
            t('recording.alert.permission_required.message')
          );
          return { success: false, error: 'permission_denied' };
        }

        const localeAvailability = await getSpeechLocaleAvailability(transcriptionLocale);
        if (localeAvailability?.installedLocales.length && !localeAvailability.isInstalled) {
          const installedText = localeAvailability.installedLocales.join(', ') || t('recording.alert.language_pack_missing.none');
          Alert.alert(
            t('recording.alert.language_pack_missing.title'),
            t('recording.alert.language_pack_missing.message', {
              locale: transcriptionLocale,
              installed: installedText,
            })
          );
          return { success: false, error: 'language_pack_missing' };
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        recorderReleasedRef.current = false;
        nativeSessionRef.current?.abort();
        baseTranscriptRef.current = currentTranscript;

        nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale, {
          onPartial: (text) => {
            onPartialTranscript?.(text);
          },
        });

        const canPersistAudio = nativeSessionRef.current?.hasRecording === true;
        skipRecorderRef.current = Boolean(nativeSessionRef.current);

        if (__DEV__) {
          if (!nativeSessionRef.current && Platform.OS === 'web') {
            log.warn('web: native session missing; check browser SpeechRecognition support/https');
          }
          log.debug('native session', {
            hasSession: Boolean(nativeSessionRef.current),
            locale: transcriptionLocale,
            canPersistAudio,
          });
        }

        hasAutoStoppedRecordingRef.current = false;
        if (!skipRecorderRef.current) {
          await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
          audioRecorder.record();
        } else if (__DEV__) {
          log.debug('skipping audioRecorder because native session active');
        }

        setIsRecording(true);
        isRecordingRef.current = true;
        return { success: true };
      } catch (err) {
        nativeSessionRef.current?.abort();
        nativeSessionRef.current = null;
        skipRecorderRef.current = false;
        isRecordingRef.current = false;
        handleRecorderError('startRecording', err);
        log.error('Failed to start recording', err);
        return { success: false, error: err instanceof Error ? err.message : 'start_failed' };
      }
    },
    [audioRecorder, t, transcriptionLocale, onPartialTranscript, handleRecorderError]
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
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
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
        if ((state === 'background' || state === 'inactive') && getRecorderIsRecording() && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        handleRecorderError('appStateChange', error);
      }
    });

    return () => {
      subscription.remove();
      try {
        if (getRecorderIsRecording() && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        if (!handleRecorderError('appStateCleanup', error)) {
          throw error;
        }
      }
    };
  }, [getRecorderIsRecording, handleRecorderError, stopRecording]);

  return {
    isRecording,
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
