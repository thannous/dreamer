import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import {
  LucidMorningVoiceNoteError,
  canLucidMorningVoiceCapture,
  classifyLucidMorningVoiceFailure,
  createIdleLucidMorningVoiceCaptureState,
  createLucidMorningVoiceNoteId,
  extensionFromLucidMorningVoiceUri,
  mimeTypeForLucidMorningVoiceExtension,
  transitionLucidMorningVoiceCapture,
  type LucidMorningVoiceCaptureState,
  type LucidMorningVoiceErrorReason,
  type LucidMorningVoiceNote,
  type LucidMorningVoiceNoteStatus,
} from '@/lib/lucid/morningVoiceNote';
import { persistLucidMorningVoiceNoteFromRecorder } from '@/services/lucidMorningVoiceNoteStorage';

const PERMISSION_ACTIVITY_SETTLE_MS = 300;

export type LucidMorningVoicePermission = 'unknown' | 'granted' | 'denied';

export type LucidMorningVoicePersistInput = {
  userScope: string;
  sourceUri: string;
  mimeType: ReturnType<typeof mimeTypeForLucidMorningVoiceExtension>;
  extension: NonNullable<ReturnType<typeof extensionFromLucidMorningVoiceUri>>;
  durationMs: number;
  status: LucidMorningVoiceNoteStatus;
  title?: string;
  transcript?: string | null;
  noteId?: string;
  now?: number;
};

export type UseLucidMorningVoiceRecorderOptions = {
  userScope: string;
  title?: string;
  transcript?: string | null;
  persist?: (input: LucidMorningVoicePersistInput) => Promise<LucidMorningVoiceNote>;
  now?: () => number;
  createNoteId?: (now: number) => string;
  onPersisted?: (note: LucidMorningVoiceNote) => void;
  onPersistenceError?: (error: LucidMorningVoiceNoteError) => void;
};

type WaitHandle = {
  promise: Promise<void>;
  cancel: () => void;
};

function toTypedError(error: unknown, fallback: LucidMorningVoiceErrorReason = 'recorder_unavailable') {
  if (error instanceof LucidMorningVoiceNoteError) return error;
  const reason = classifyLucidMorningVoiceFailure(error);
  if (
    reason === 'storage_full' ||
    reason === 'permission_denied' ||
    reason === 'interrupted' ||
    reason === 'recorder_unavailable' ||
    reason === fallback
  ) {
    return new LucidMorningVoiceNoteError(reason);
  }
  return new LucidMorningVoiceNoteError(fallback);
}

function waitForActiveAppState(): WaitHandle {
  let cancelled = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let subscription: { remove: () => void } | null = null;
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    if (Platform.OS === 'web' || !AppState.currentState || AppState.currentState === 'active') {
      resolve();
      return;
    }
    const finish = () => {
      if (cancelled) return;
      settleTimer = setTimeout(() => {
        if (!cancelled) resolve();
      }, PERMISSION_ACTIVITY_SETTLE_MS);
    };
    subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        subscription?.remove();
        subscription = null;
        finish();
      }
    });
    void reject;
  });
  return {
    promise,
    cancel() {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      subscription?.remove();
      resolvePromise();
    },
  };
}

async function resetAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    allowsBackgroundRecording: false,
  });
}

export function useLucidMorningVoiceRecorder(options: UseLucidMorningVoiceRecorderOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [capture, setCapture] = useState<LucidMorningVoiceCaptureState>(
    createIdleLucidMorningVoiceCaptureState
  );
  const [permission, setPermission] = useState<LucidMorningVoicePermission>('unknown');
  const [note, setNote] = useState<LucidMorningVoiceNote | null>(null);
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [observedDurationMs, setObservedDurationMs] = useState(0);
  const [persistenceError, setPersistenceError] = useState<LucidMorningVoiceErrorReason | null>(null);

  const captureRef = useRef(capture);
  const permissionRef = useRef(permission);
  const sourceUriRef = useRef<string | null>(null);
  const noteRef = useRef<LucidMorningVoiceNote | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const sessionScopeRef = useRef<string | null>(null);
  const sessionTitleRef = useRef<string | undefined>(undefined);
  const sessionTranscriptRef = useRef<string | null | undefined>(undefined);
  const audioModeEnabledRef = useRef(false);
  const persistInFlightRef = useRef<Promise<LucidMorningVoiceNote | null> | null>(null);
  const transitionRef = useRef<Promise<unknown> | null>(null);
  const pendingPersistKindRef = useRef<'ready' | 'draft' | null>(null);
  const recorderStoppedRef = useRef(false);
  const maxDurationRef = useRef(0);
  const mountedRef = useRef(true);
  const permissionWaitRef = useRef<WaitHandle | null>(null);
  const optionsRef = useRef(options);
  const finalizeRef = useRef<(kind: 'ready' | 'draft') => Promise<LucidMorningVoiceNote | null>>(
    async () => null
  );

  const durationMillis = Math.max(observedDurationMs, recorderState.durationMillis ?? 0);

  const setSafeCapture = useCallback((next: LucidMorningVoiceCaptureState) => {
    captureRef.current = next;
    if (mountedRef.current) setCapture(next);
  }, []);

  const applyCapture = useCallback(
    (
      event: Parameters<typeof transitionLucidMorningVoiceCapture>[1],
      details?: Parameters<typeof transitionLucidMorningVoiceCapture>[2]
    ) => {
      const next = transitionLucidMorningVoiceCapture(captureRef.current, event, details);
      setSafeCapture(next);
      return next;
    },
    [setSafeCapture]
  );

  const rememberDuration = useCallback((candidate?: number | null) => {
    const next = Math.max(maxDurationRef.current, candidate ?? 0);
    maxDurationRef.current = next;
    if (mountedRef.current) setObservedDurationMs(next);
    return next;
  }, []);

  const persistNote = useCallback(
    async (status: LucidMorningVoiceNoteStatus): Promise<LucidMorningVoiceNote | null> => {
      if (persistInFlightRef.current) return persistInFlightRef.current;
      const current = optionsRef.current;
      const work = (async () => {
        const uri = sourceUriRef.current ?? recorder.uri;
        if (!uri) {
          throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
        }
        const extension = extensionFromLucidMorningVoiceUri(uri);
        if (!extension) {
          throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
        }
        const durationMs = Math.max(
          maxDurationRef.current,
          recorder.getStatus?.().durationMillis ?? 0
        );
        rememberDuration(durationMs);
        if (status === 'ready' && durationMs <= 0) {
          throw new LucidMorningVoiceNoteError('invalid_duration', 'Voice note duration is invalid');
        }
        const persist = current.persist ?? persistLucidMorningVoiceNoteFromRecorder;
        const saved = await persist({
          userScope: sessionScopeRef.current ?? current.userScope,
          sourceUri: uri,
          mimeType: mimeTypeForLucidMorningVoiceExtension(extension),
          extension,
          durationMs,
          status,
          title: sessionTitleRef.current,
          transcript: sessionTranscriptRef.current ?? null,
          noteId: noteIdRef.current ?? undefined,
          now: current.now?.() ?? Date.now(),
        });
        noteRef.current = saved;
        pendingPersistKindRef.current = null;
        if (mountedRef.current) {
          setNote(saved);
          setPersistenceError(null);
        }
        return saved;
      })();
      persistInFlightRef.current = work;
      try {
        const saved = await work;
        try {
          current.onPersisted?.(saved);
        } catch {
          // Consumer callbacks must not rewrite a successful persist.
        }
        return saved;
      } catch (error) {
        const typed = toTypedError(error, 'persistence_failed');
        if (mountedRef.current) setPersistenceError(typed.reason);
        try {
          current.onPersistenceError?.(typed);
        } catch {
          // Consumer callbacks must not create an extra unhandled rejection.
        }
        throw typed;
      } finally {
        persistInFlightRef.current = null;
      }
    },
    [recorder, rememberDuration]
  );

  const disableAudioMode = useCallback(async () => {
    if (!audioModeEnabledRef.current) return;
    try {
      await resetAudioMode();
    } catch {
      // Mode reset is best-effort after a capture attempt.
    }
    audioModeEnabledRef.current = false;
  }, []);

  const failSession = useCallback(
    async (error: unknown, fallback: LucidMorningVoiceErrorReason = 'recorder_unavailable') => {
      const typed = toTypedError(error, fallback);
      if (canLucidMorningVoiceCapture('fail', captureRef.current.phase)) {
        applyCapture('fail', { noteId: noteIdRef.current, errorReason: typed.reason });
      } else if (mountedRef.current) {
        setPersistenceError(typed.reason);
      }
      await disableAudioMode();
      return typed;
    },
    [applyCapture, disableAudioMode]
  );

  const finalizeSession = useCallback(
    async (kind: 'ready' | 'draft') => {
      if (persistInFlightRef.current) return persistInFlightRef.current;
      if (captureRef.current.phase === 'stopped' || captureRef.current.phase === 'recoverable') {
        return noteRef.current;
      }
      const retrying = pendingPersistKindRef.current != null && recorderStoppedRef.current;
      const persistKind = pendingPersistKindRef.current ?? kind;
      const canFinalizeActive =
        captureRef.current.phase === 'recording' || captureRef.current.phase === 'paused';
      const canRetryPersist =
        retrying &&
        (captureRef.current.phase === 'stopping' || captureRef.current.phase === 'interrupted');
      if (!canFinalizeActive && !canRetryPersist) {
        return noteRef.current;
      }
      pendingPersistKindRef.current = persistKind;
      try {
        if (canFinalizeActive) {
          applyCapture(persistKind === 'draft' ? 'interrupt' : 'stop', { noteId: noteIdRef.current });
        }
        if (!recorderStoppedRef.current) {
          try {
            const status = recorder.getStatus?.();
            if (
              status?.isRecording ||
              captureRef.current.phase === 'stopping' ||
              captureRef.current.phase === 'interrupted'
            ) {
              rememberDuration(status?.durationMillis ?? maxDurationRef.current);
              await recorder.stop();
              recorderStoppedRef.current = true;
            }
          } catch (error) {
            throw toTypedError(error, 'recorder_unavailable');
          }
        }
        if (recorderStoppedRef.current) {
          await disableAudioMode();
        }
        const uri = recorder.uri ?? sourceUriRef.current;
        if (uri) {
          sourceUriRef.current = uri;
          if (mountedRef.current) setSourceUri(uri);
        }
        rememberDuration(recorder.getStatus?.().durationMillis ?? 0);
        const saved = await persistNote(persistKind);
        if (
          canLucidMorningVoiceCapture(
            persistKind === 'ready' ? 'persist_ready' : 'persist_draft',
            captureRef.current.phase
          )
        ) {
          applyCapture(persistKind === 'ready' ? 'persist_ready' : 'persist_draft', {
            noteId: saved?.id ?? noteIdRef.current,
          });
        }
        return saved;
      } catch (error) {
        const typed = toTypedError(error);
        if (typed.reason === 'storage_full' || typed.reason === 'persistence_failed') {
          await disableAudioMode();
          throw typed;
        }
        throw await failSession(typed);
      }
    },
    [applyCapture, disableAudioMode, failSession, persistNote, recorder, rememberDuration]
  );

  const runSerialized = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    const previous = transitionRef.current ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    transitionRef.current = current;
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (transitionRef.current === current) transitionRef.current = null;
    }
  }, []);

  const enqueueFinalize = useCallback(
    (kind: 'ready' | 'draft') =>
      runSerialized(async () => {
        try {
          return await finalizeRef.current(kind);
        } catch (error) {
          const typed = toTypedError(error);
          if (mountedRef.current && (typed.reason === 'storage_full' || typed.reason === 'persistence_failed')) {
            setPersistenceError(typed.reason);
          }
          return null;
        }
      }),
    [runSerialized]
  );

  const start = useCallback(async () => {
    return runSerialized(async () => {
      if (
        captureRef.current.phase === 'recording' ||
        captureRef.current.phase === 'paused' ||
        captureRef.current.phase === 'requesting_permission' ||
        captureRef.current.phase === 'stopping' ||
        captureRef.current.phase === 'interrupted'
      ) {
        return;
      }
      pendingPersistKindRef.current = null;
      recorderStoppedRef.current = false;
      noteRef.current = null;
      sourceUriRef.current = null;
      maxDurationRef.current = 0;
      if (mountedRef.current) {
        setNote(null);
        setSourceUri(null);
        setPersistenceError(null);
        setObservedDurationMs(0);
      }
      const current = optionsRef.current;
      const now = current.now?.() ?? Date.now();
      const noteId = current.createNoteId?.(now) ?? createLucidMorningVoiceNoteId(now);
      noteIdRef.current = noteId;
      sessionScopeRef.current = current.userScope;
      sessionTitleRef.current = current.title;
      sessionTranscriptRef.current = current.transcript;
      applyCapture('create', { noteId });
      applyCapture('request_permission', { noteId });
      let granted = permissionRef.current === 'granted';
      let prompted = false;
      if (!granted) {
        try {
          const existing = await AudioModule.getRecordingPermissionsAsync();
          granted = existing.granted === true;
          if (granted) {
            permissionRef.current = 'granted';
            if (mountedRef.current) setPermission('granted');
          }
        } catch (error) {
          throw await failSession(error, 'recorder_unavailable');
        }
      }
      if (!granted) {
        prompted = true;
        try {
          const requested = await AudioModule.requestRecordingPermissionsAsync();
          granted = requested.granted === true;
        } catch (error) {
          throw await failSession(error, 'recorder_unavailable');
        }
        permissionRef.current = granted ? 'granted' : 'denied';
        if (mountedRef.current) setPermission(granted ? 'granted' : 'denied');
      }
      if (!mountedRef.current) return;
      if (!granted) {
        applyCapture('permission_denied', { noteId, errorReason: 'permission_denied' });
        return;
      }
      if (prompted) {
        const wait = waitForActiveAppState();
        permissionWaitRef.current = wait;
        await wait.promise;
        permissionWaitRef.current = null;
        if (!mountedRef.current) return;
      }
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
          allowsBackgroundRecording: false,
        });
        audioModeEnabledRef.current = true;
        if (!mountedRef.current) {
          await disableAudioMode();
          return;
        }
        await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
        if (!mountedRef.current) {
          await disableAudioMode();
          return;
        }
        recorder.record();
        recorderStoppedRef.current = false;
        const uri = recorder.uri;
        if (uri) {
          sourceUriRef.current = uri;
          if (mountedRef.current) setSourceUri(uri);
        }
        rememberDuration(recorder.getStatus?.().durationMillis ?? 0);
        applyCapture('permission_granted', { noteId });
      } catch (error) {
        throw await failSession(error, 'recorder_unavailable');
      }
    });
  }, [applyCapture, disableAudioMode, failSession, recorder, rememberDuration, runSerialized]);

  const pause = useCallback(async () => {
    return runSerialized(async () => {
      if (!canLucidMorningVoiceCapture('pause', captureRef.current.phase)) return;
      try {
        recorder.pause();
        rememberDuration(recorder.getStatus?.().durationMillis ?? 0);
        applyCapture('pause', { noteId: noteIdRef.current });
      } catch (error) {
        throw await failSession(error, 'recorder_unavailable');
      }
    });
  }, [applyCapture, failSession, recorder, rememberDuration, runSerialized]);

  const resume = useCallback(async () => {
    return runSerialized(async () => {
      if (!canLucidMorningVoiceCapture('resume', captureRef.current.phase)) return;
      try {
        recorder.record();
        applyCapture('resume', { noteId: noteIdRef.current });
      } catch (error) {
        throw await failSession(error, 'recorder_unavailable');
      }
    });
  }, [applyCapture, failSession, recorder, runSerialized]);

  const stop = useCallback(async () => {
    return runSerialized(async () => finalizeRef.current(pendingPersistKindRef.current ?? 'ready'));
  }, [runSerialized]);

  const reset = useCallback(() => {
    if (!canLucidMorningVoiceCapture('reset', captureRef.current.phase)) return;
    applyCapture('reset');
    pendingPersistKindRef.current = null;
    recorderStoppedRef.current = false;
    if (mountedRef.current) setPersistenceError(null);
  }, [applyCapture]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    finalizeRef.current = finalizeSession;
  }, [finalizeSession]);

  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  useEffect(() => {
    permissionRef.current = permission;
  }, [permission]);

  useEffect(() => {
    if (
      recorderState.mediaServicesDidReset &&
      (captureRef.current.phase === 'recording' || captureRef.current.phase === 'paused')
    ) {
      void enqueueFinalize('draft');
    }
  }, [enqueueFinalize, recorderState.mediaServicesDidReset]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'inactive' && state !== 'background') return;
      if (captureRef.current.phase !== 'recording' && captureRef.current.phase !== 'paused') return;
      void enqueueFinalize('draft');
    });
    return () => {
      subscription.remove();
    };
  }, [enqueueFinalize]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      permissionWaitRef.current?.cancel();
      if (captureRef.current.phase === 'recording' || captureRef.current.phase === 'paused') {
        void enqueueFinalize('draft');
      }
    };
  }, [enqueueFinalize]);

  return {
    capture,
    permission,
    durationMillis,
    note,
    sourceUri,
    errorReason: persistenceError ?? capture.errorReason,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
