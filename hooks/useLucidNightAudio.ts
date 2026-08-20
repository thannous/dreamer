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
  MAX_LUCID_PREVIEW_VOLUME,
  type LucidAudioSafety,
  type LucidNightSignalPlan,
  type LucidNightSoundId,
} from '@/lib/lucid/audio';
import {
  cancelLucidNightCues,
  restoreLucidNightSignalPlan,
  scheduleLucidNightCues,
} from '@/services/lucidTrainerNotifications';

// The countdown renders hours and minutes only, so a second-by-second tick would
// buy nothing and cost ~28 800 wake-ups over an eight-hour night.
const TICK_MS = 15_000;
const NIGHT_CUE_SOURCES: Readonly<Record<string, AudioSource>> = {
  'lucid_cue_rain_very_low.wav': require('@/assets/lucid/audio/lucid_cue_rain_very_low.wav'),
  'lucid_cue_rain_low.wav': require('@/assets/lucid/audio/lucid_cue_rain_low.wav'),
  'lucid_cue_rain.wav': require('@/assets/lucid/audio/lucid_cue_rain.wav'),
  'lucid_cue_ocean_very_low.wav': require('@/assets/lucid/audio/lucid_cue_ocean_very_low.wav'),
  'lucid_cue_ocean_low.wav': require('@/assets/lucid/audio/lucid_cue_ocean_low.wav'),
  'lucid_cue_ocean.wav': require('@/assets/lucid/audio/lucid_cue_ocean.wav'),
  'lucid_cue_brown_noise_very_low.wav': require('@/assets/lucid/audio/lucid_cue_brown_noise_very_low.wav'),
  'lucid_cue_brown_noise_low.wav': require('@/assets/lucid/audio/lucid_cue_brown_noise_low.wav'),
  'lucid_cue_brown_noise.wav': require('@/assets/lucid/audio/lucid_cue_brown_noise.wav'),
};

// The remaining seconds live outside React state: only the leaf that draws the
// countdown subscribes, so a tick never re-renders the whole night screen.
export type LucidNightRemaining = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

export function useLucidNightAudio(params: {
  soundId: LucidNightSoundId;
  volume: number;
  timerMinutes: number;
  safety: LucidAudioSafety;
  notificationTitle: string;
  notificationBody: string;
}) {
  const previewSoundFile = getLucidNightSoundFile(
    params.soundId,
    Math.min(params.volume, MAX_LUCID_PREVIEW_VOLUME)
  );
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
    async (durationMs: number) => {
      if (!status.isLoaded) throw new Error('audio_not_loaded');
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      clearStopTimer();
      await player.seekTo(0);
      // expo-audio controls are mutable native properties by design.
      player.loop = false;
      // Waveform amplitude encodes the prudent level used by native cues too.
      player.volume = 1;
      player.play();
      stopTimerRef.current = setTimeout(() => {
        void stopPlayback();
      }, durationMs);
    },
    [clearStopTimer, player, status.isLoaded, stopPlayback]
  );

  const preview = useCallback(async () => {
    setError(null);
    const result = createLucidPreviewPlan({
      nowAt: Date.now(),
      requestedVolume: params.volume,
      requestedDurationMs: 7_000,
      soundId: params.soundId,
      safety: params.safety,
    });
    if (result.status === 'blocked') {
      setError(result.reason);
      return false;
    }
    try {
      await playPreview(result.plan.stopAt - result.plan.startsAt);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'playback_failed');
      return false;
    }
  }, [params.safety, params.soundId, params.volume, playPreview]);
  /* eslint-enable react-hooks/immutability */

  const startNight = useCallback(async () => {
    setError(null);
    setIsScheduling(true);
    const sessionStartAt = Date.now();
    const result = createLucidNightSignalPlan({
      enabled: true,
      sessionStartAt,
      timerMinutes: params.timerMinutes,
      cueOffsetsMinutes: [120, 180, 240, 300],
      requestedVolume: params.volume,
      requestedCueDurationMs: 7_000,
      soundId: params.soundId,
      safety: params.safety,
    });
    if (result.status === 'blocked') {
      setError(result.reason);
      setIsScheduling(false);
      return false;
    }

    try {
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
      setPlan(result.plan);
      setRemainingSeconds(
        Math.max(0, Math.ceil((result.plan.timerEndsAt - Date.now()) / 1000))
      );
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'notification_schedule_failed');
      return false;
    } finally {
      setIsScheduling(false);
    }
  }, [
    params.notificationBody,
    params.notificationTitle,
    params.safety,
    params.soundId,
    params.timerMinutes,
    params.volume,
    setRemainingSeconds,
    stopPlayback,
  ]);

  const stopNight = useCallback(async () => {
    setError(null);
    try {
      await cancelLucidNightCues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'notification_cancel_failed');
    }
    setPlan(null);
    setRemainingSeconds(0);
    await stopPlayback();
  }, [setRemainingSeconds, stopPlayback]);

  useEffect(() => {
    let active = true;
    void restoreLucidNightSignalPlan()
      .then((restored) => {
        if (!active || !restored) return;
        setPlan(restored);
        setRemainingSeconds(
          Math.max(0, Math.ceil((restored.timerEndsAt - Date.now()) / 1000))
        );
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'notification_restore_failed');
        }
      });
    return () => {
      active = false;
    };
  }, [setRemainingSeconds]);

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
