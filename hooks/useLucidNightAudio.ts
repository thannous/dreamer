import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createLucidNightSignalPlan,
  createLucidPreviewPlan,
  getLucidNightSoundFile,
  LUCID_TLR_CUE_DURATION_MS,
  MAX_LUCID_REDUCED_NIGHT_VOLUME,
  resolveLucidNightCueCalibration,
  shouldRestoreLucidNightSignalPlan,
  type LucidAudioSafety,
  type LucidHeardWokeObservation,
  type LucidNightSignalPlan,
} from '@/lib/lucid/audio';
import { canUseLucidNightSignals, type LucidSafetyPolicy } from '@/lib/lucid/safety';
import {
  cancelLucidNightCues,
  restoreLucidNightSignalPlan,
  scheduleLucidNightCues,
} from '@/services/lucidTrainerNotifications';

// The countdown renders hours and minutes only, so a second-by-second tick would
// buy nothing and cost ~28 800 wake-ups over an eight-hour night.
const TICK_MS = 15_000;
const LUCID_TLR_SOUND_ID = 'rain' as const;
const NIGHT_CUE_SOURCES: Readonly<Record<string, AudioSource>> = {
  'lucid_cue_rain_very_low.wav': require('@/assets/lucid/audio/lucid_cue_rain_very_low.wav'),
  'lucid_cue_rain_low.wav': require('@/assets/lucid/audio/lucid_cue_rain_low.wav'),
  'lucid_cue_rain.wav': require('@/assets/lucid/audio/lucid_cue_rain.wav'),
};

export type LucidNightAudioExperiment = LucidHeardWokeObservation;

function isStaleRestoredPlan(
  plan: LucidNightSignalPlan,
  calibration: ReturnType<typeof resolveLucidNightCueCalibration>
): boolean {
  if (calibration.status === 'suspended') return true;
  if (calibration.status === 'reduced') {
    return plan.volume > MAX_LUCID_REDUCED_NIGHT_VOLUME || plan.cues.length > calibration.maxCues;
  }
  return false;
}

function currentPlanBlockReason(
  policy: LucidSafetyPolicy,
  calibration: ReturnType<typeof resolveLucidNightCueCalibration>
): string | null {
  if (calibration.status === 'suspended') return 'no_safe_signals';
  if (!canUseLucidNightSignals(policy)) return policy.reasons[0] ?? 'night_signals_blocked';
  return null;
}

// The remaining seconds live outside React state: only the leaf that draws the
// countdown subscribes, so a tick never re-renders the whole night screen.
export type LucidNightRemaining = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

export function useLucidNightAudio(params: {
  volume: number;
  timerMinutes: number;
  safety: LucidAudioSafety;
  policy: LucidSafetyPolicy;
  notificationTitle: string;
  notificationBody: string;
  experiments?: readonly LucidNightAudioExperiment[] | null;
  /** Ignored: TLR preview/night always use the fixed rain cue. */
  soundId?: string;
}) {
  const experiments = useMemo(
    () => params.experiments ?? [],
    [params.experiments]
  );
  const calibration = useMemo(
    () =>
      resolveLucidNightCueCalibration({
        requestedVolume: params.volume,
        policy: params.policy,
        experiments,
      }),
    [experiments, params.policy, params.volume]
  );
  const previewSoundFile = getLucidNightSoundFile(LUCID_TLR_SOUND_ID, calibration.volume || params.volume);
  const player = useAudioPlayer(NIGHT_CUE_SOURCES[previewSoundFile], {
    downloadFirst: true,
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  const [plan, setPlan] = useState<LucidNightSignalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(0);
  const remainingListenersRef = useRef<Set<() => void>>(new Set());
  const policyRef = useRef(params.policy);
  const calibrationRef = useRef(calibration);
  const nightGenerationRef = useRef(0);
  const startInFlightRef = useRef(false);

  const setRemainingSeconds = useCallback((seconds: number) => {
    if (remainingRef.current === seconds) return;
    remainingRef.current = seconds;
    remainingListenersRef.current.forEach((listener) => listener());
  }, []);

  const remaining = useMemo<LucidNightRemaining>(
    () => ({
      getSnapshot: () => remainingRef.current,
      subscribe: (listener) => {
        remainingListenersRef.current.add(listener);
        return () => {
          remainingListenersRef.current.delete(listener);
        };
      },
    }),
    []
  );

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }, []);

  const stopPlayback = useCallback(async () => {
    clearStopTimer();
    try {
      player.pause();
      await player.seekTo(0);
    } catch {
      // The component may have released its native preview player already.
    }
  }, [clearStopTimer, player]);

  /* eslint-disable react-hooks/immutability -- expo-audio player controls are mutable native handles. */
  const playPreview = useCallback(
    async (soundFile: string, durationMs: number) => {
      if (!status.isLoaded) throw new Error('audio_not_loaded');
      if (soundFile !== previewSoundFile || !NIGHT_CUE_SOURCES[soundFile]) {
        throw new Error('audio_source_mismatch');
      }
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      clearStopTimer();
      await player.seekTo(0);
      player.loop = false;
      player.volume = 1;
      player.play();
      stopTimerRef.current = setTimeout(() => {
        void stopPlayback();
      }, durationMs);
    },
    [clearStopTimer, player, previewSoundFile, status.isLoaded, stopPlayback]
  );

  const preview = useCallback(async () => {
    setError(null);
    const result = createLucidPreviewPlan({
      nowAt: Date.now(),
      requestedVolume: params.volume,
      requestedDurationMs: LUCID_TLR_CUE_DURATION_MS,
      soundId: LUCID_TLR_SOUND_ID,
      safety: params.safety,
      policy: params.policy,
      experiments,
    });
    if (result.status === 'blocked') {
      setError(result.reason);
      return false;
    }
    try {
      await playPreview(result.plan.soundFile, result.plan.stopAt - result.plan.startsAt);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'playback_failed');
      return false;
    }
  }, [experiments, params.policy, params.safety, params.volume, playPreview]);
  /* eslint-enable react-hooks/immutability */

  const bumpNightGeneration = useCallback(() => {
    nightGenerationRef.current += 1;
    return nightGenerationRef.current;
  }, []);

  const startNight = useCallback(async () => {
    if (startInFlightRef.current) return false;
    startInFlightRef.current = true;
    setError(null);
    setIsScheduling(true);
    const generation = bumpNightGeneration();
    try {
      const sessionStartAt = Date.now();
      const result = createLucidNightSignalPlan({
        enabled: true,
        sessionStartAt,
        timerMinutes: params.timerMinutes,
        requestedVolume: params.volume,
        requestedCueDurationMs: LUCID_TLR_CUE_DURATION_MS,
        soundId: LUCID_TLR_SOUND_ID,
        safety: params.safety,
        policy: params.policy,
        experiments,
      });
      if (result.status === 'blocked') {
        setError(result.reason);
        return false;
      }

      await stopPlayback();
      const scheduled = await scheduleLucidNightCues(result.plan, {
        now: sessionStartAt,
        requestPermissionIfNeeded: true,
        content: {
          title: params.notificationTitle,
          body: params.notificationBody,
          url: '/lucid/(tabs)/night',
        },
      });
      if (scheduled.permission !== 'granted' || scheduled.scheduledIds.length === 0) {
        setError(`notifications_${scheduled.permission}`);
        return false;
      }

      const remainingSeconds = Math.max(
        0,
        Math.ceil((result.plan.timerEndsAt - Date.now()) / 1000)
      );
      const cancelNewlyScheduledSession = async (): Promise<'cancelled' | 'failed' | 'superseded'> => {
        const expectedGeneration = nightGenerationRef.current;
        try {
          await cancelLucidNightCues({ sessionId: result.plan.sessionId });
        } catch {
          if (expectedGeneration !== nightGenerationRef.current) return 'superseded';
          setPlan(result.plan);
          setRemainingSeconds(remainingSeconds);
          setError('notification_cancel_failed');
          await stopPlayback();
          return 'failed';
        }
        if (expectedGeneration !== nightGenerationRef.current) return 'superseded';
        return 'cancelled';
      };

      if (generation !== nightGenerationRef.current) {
        await cancelNewlyScheduledSession();
        return false;
      }
      const currentPolicy = policyRef.current;
      const currentCalibration = calibrationRef.current;
      const blockReason = currentPlanBlockReason(currentPolicy, currentCalibration);
      if (blockReason || isStaleRestoredPlan(result.plan, currentCalibration)) {
        const outcome = await cancelNewlyScheduledSession();
        if (outcome === 'cancelled') {
          setError(blockReason ?? 'no_safe_signals');
        }
        return false;
      }
      setPlan(result.plan);
      setRemainingSeconds(remainingSeconds);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'notification_schedule_failed');
      return false;
    } finally {
      startInFlightRef.current = false;
      setIsScheduling(false);
    }
  }, [
    bumpNightGeneration,
    experiments,
    params.notificationBody,
    params.notificationTitle,
    params.policy,
    params.safety,
    params.timerMinutes,
    params.volume,
    setRemainingSeconds,
    stopPlayback,
  ]);

  const stopNight = useCallback(async (blockReason?: string | null) => {
    const generation = bumpNightGeneration();
    try {
      await cancelLucidNightCues();
    } catch {
      if (generation !== nightGenerationRef.current) return;
      setError('notification_cancel_failed');
      await stopPlayback();
      return;
    }
    if (generation !== nightGenerationRef.current) return;
    setPlan(null);
    setRemainingSeconds(0);
    setError(blockReason ?? null);
    await stopPlayback();
  }, [bumpNightGeneration, setRemainingSeconds, stopPlayback]);

  useEffect(() => {
    policyRef.current = params.policy;
    calibrationRef.current = calibration;
  }, [calibration, params.policy]);

  useEffect(() => {
    let active = true;
    const generation = nightGenerationRef.current;
    void restoreLucidNightSignalPlan()
      .then(async (restored) => {
        if (!active || generation !== nightGenerationRef.current) return;
        if (!restored) return;
        const currentCalibration = calibrationRef.current;
        const currentPolicy = policyRef.current;
        if (
          !shouldRestoreLucidNightSignalPlan(restored, currentPolicy) ||
          isStaleRestoredPlan(restored, currentCalibration)
        ) {
          try {
            await cancelLucidNightCues();
          } catch {
            if (!active || generation !== nightGenerationRef.current) return;
            setPlan(restored);
            setRemainingSeconds(
              Math.max(0, Math.ceil((restored.timerEndsAt - Date.now()) / 1000))
            );
            setError('notification_cancel_failed');
            await stopPlayback();
            return;
          }
          if (!active || generation !== nightGenerationRef.current) return;
          setPlan(null);
          setRemainingSeconds(0);
          setError(currentPlanBlockReason(currentPolicy, currentCalibration) ?? 'no_safe_signals');
          return;
        }
        setPlan(restored);
        setRemainingSeconds(
          Math.max(0, Math.ceil((restored.timerEndsAt - Date.now()) / 1000))
        );
      })
      .catch((cause: unknown) => {
        if (active && generation === nightGenerationRef.current) {
          setError(cause instanceof Error ? cause.message : 'notification_restore_failed');
        }
      });
    return () => {
      active = false;
    };
  }, [setRemainingSeconds, stopPlayback]);

  useEffect(() => {
    if (!plan) return;
    if (error === 'notification_cancel_failed') return;
    const blockReason = currentPlanBlockReason(params.policy, calibration);
    if (!blockReason && !isStaleRestoredPlan(plan, calibration)) return;
    void stopNight(blockReason ?? 'no_safe_signals');
  }, [calibration, error, plan, params.policy, stopNight]);

  useEffect(() => {
    if (!plan) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((plan.timerEndsAt - Date.now()) / 1000)
      );
      setRemainingSeconds(seconds);
      if (seconds === 0) void stopNight();
    };
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [plan, setRemainingSeconds, stopNight]);

  useEffect(
    () => () => {
      clearStopTimer();
      try {
        player.pause();
      } catch {
        // The native preview player may already be released.
      }
    },
    [clearStopTimer, player]
  );

  return useMemo(
    () => ({
      error,
      isLoaded: status.isLoaded,
      isPlaying: status.playing,
      isScheduling,
      plan,
      preview,
      remaining,
      startNight,
      stopNight,
    }),
    [
      error,
      isScheduling,
      plan,
      preview,
      remaining,
      startNight,
      status.isLoaded,
      status.playing,
      stopNight,
    ]
  );
}
