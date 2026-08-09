import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type SleepSoundConfig,
  type SleepTimerMinutes,
} from '@/lib/sleepSounds';

const SLEEP_SOUND_VOLUME = 0.65;
const TIMER_UPDATE_INTERVAL_MS = 500;

type UseSleepSoundPlayerOptions = {
  sound: SleepSoundConfig;
  durationMinutes: SleepTimerMinutes;
  title: string;
  albumTitle: string;
};

export function useSleepSoundPlayer({
  sound,
  durationMinutes,
  title,
  albumTitle,
}: UseSleepSoundPlayerOptions) {
  const player = useAudioPlayer(sound.source, {
    downloadFirst: true,
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const remainingMsRef = useRef(durationMinutes * 60_000);
  const startedAtMsRef = useRef<number | null>(null);
  const previousNativePlayingRef = useRef(status.playing);

  const clearLockScreen = useCallback(() => {
    try {
      player.clearLockScreenControls();
    } catch {
      // Lock-screen controls are best-effort on web and unsupported devices.
    }
  }, [player]);

  const getRemainingMs = useCallback(() => {
    if (startedAtMsRef.current === null) {
      return remainingMsRef.current;
    }

    return Math.max(
      0,
      remainingMsRef.current - (Date.now() - startedAtMsRef.current),
    );
  }, []);

  const commitElapsedTime = useCallback(() => {
    const nextRemainingMs = getRemainingMs();
    remainingMsRef.current = nextRemainingMs;
    startedAtMsRef.current = null;
    setRemainingSeconds(Math.ceil(nextRemainingMs / 1000));
    return nextRemainingMs;
  }, [getRemainingMs]);

  const finishSession = useCallback(() => {
    remainingMsRef.current = 0;
    startedAtMsRef.current = null;
    setRemainingSeconds(0);
    setTimerRunning(false);
    try {
      player.pause();
    } catch {
      // The native player may already have been released during route cleanup.
    }
    clearLockScreen();
  }, [clearLockScreen, player]);

  const stop = useCallback(async () => {
    player.pause();
    clearLockScreen();
    const sessionDurationSeconds = durationMinutes * 60;
    remainingMsRef.current = sessionDurationSeconds * 1000;
    startedAtMsRef.current = null;
    setRemainingSeconds(sessionDurationSeconds);
    setTimerRunning(false);
    setHasStarted(false);
    setError(null);

    if (status.isLoaded) {
      try {
        await player.seekTo(0);
      } catch {
        // The source may be changing; the next play request seeks again.
      }
    }
  }, [clearLockScreen, durationMinutes, player, status.isLoaded]);

  // expo-audio intentionally exposes player controls as mutable properties.
  // eslint-disable-next-line react-hooks/immutability
  const play = useCallback(async () => {
    if (!status.isLoaded) return;

    setError(null);
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
      });

      // eslint-disable-next-line react-hooks/immutability
      player.loop = true;
      player.volume = SLEEP_SOUND_VOLUME;

      const shouldRestart = !hasStarted || remainingMsRef.current <= 0;
      if (shouldRestart) {
        const sessionDurationSeconds = durationMinutes * 60;
        remainingMsRef.current = sessionDurationSeconds * 1000;
        setRemainingSeconds(sessionDurationSeconds);
        await player.seekTo(0);
      }

      player.setActiveForLockScreen(
        true,
        {
          title,
          artist: 'Noctalia',
          albumTitle,
        },
        {
          isLiveStream: false,
          showSeekBackward: false,
          showSeekForward: false,
        },
      );
      startedAtMsRef.current = Date.now();
      player.play();
      setHasStarted(true);
      setTimerRunning(true);
    } catch (playbackError) {
      if (__DEV__) {
        console.warn('[SleepSounds] Failed to start playback', playbackError);
      }
      startedAtMsRef.current = null;
      setTimerRunning(false);
      clearLockScreen();
      setError('playback_failed');
    }
  }, [
    albumTitle,
    clearLockScreen,
    durationMinutes,
    hasStarted,
    player,
    status.isLoaded,
    title,
  ]);

  const pause = useCallback(() => {
    commitElapsedTime();
    setTimerRunning(false);
    player.pause();
  }, [commitElapsedTime, player]);

  useEffect(() => {
    if (!timerRunning) return;

    const updateTimer = () => {
      const nextRemainingMs = getRemainingMs();
      if (nextRemainingMs <= 0) {
        finishSession();
        return;
      }
      setRemainingSeconds(Math.ceil(nextRemainingMs / 1000));
    };

    updateTimer();
    const timerId = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [finishSession, getRemainingMs, timerRunning]);

  useEffect(() => {
    const wasPlaying = previousNativePlayingRef.current;
    previousNativePlayingRef.current = status.playing;

    if (wasPlaying && !status.playing && timerRunning) {
      commitElapsedTime();
      setTimerRunning(false);
      return;
    }

    if (
      !wasPlaying &&
      status.playing &&
      hasStarted &&
      !timerRunning &&
      remainingMsRef.current > 0
    ) {
      startedAtMsRef.current = Date.now();
      setTimerRunning(true);
    }
  }, [commitElapsedTime, hasStarted, status.playing, timerRunning]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        commitElapsedTime();
        setTimerRunning(false);
        try {
          player.pause();
        } catch {
          // useAudioPlayer may release its native shared object before this
          // focus cleanup runs during route unmount.
        }
        clearLockScreen();
      };
    }, [clearLockScreen, commitElapsedTime, player]),
  );

  return {
    error,
    hasStarted,
    isLoaded: status.isLoaded,
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    pause,
    play,
    remainingSeconds: hasStarted ? remainingSeconds : durationMinutes * 60,
    stop,
  };
}
