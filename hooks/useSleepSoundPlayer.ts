import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getSleepSoundStartOffset,
  type SleepSoundConfig,
  type SleepTimerMinutes,
} from '@/lib/sleepSounds';

const SLEEP_SOUND_VOLUME = 0.65;

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

  const startOffset = useMemo(
    () => getSleepSoundStartOffset(durationMinutes),
    [durationMinutes],
  );

  const clearLockScreen = useCallback(() => {
    try {
      player.clearLockScreenControls();
    } catch {
      // Lock-screen controls are best-effort on web and unsupported devices.
    }
  }, [player]);

  const stop = useCallback(async () => {
    player.pause();
    clearLockScreen();
    setHasStarted(false);
    setError(null);

    if (status.isLoaded) {
      try {
        await player.seekTo(startOffset);
      } catch {
        // The source may be changing; the next play request seeks again.
      }
    }
  }, [clearLockScreen, player, startOffset, status.isLoaded]);

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

      // expo-audio intentionally exposes these player controls as mutable properties.
      // eslint-disable-next-line react-hooks/immutability
      player.loop = false;
      player.volume = SLEEP_SOUND_VOLUME;

      const shouldRestart = !hasStarted || status.didJustFinish || status.currentTime >= status.duration - 1;
      if (shouldRestart) {
        await player.seekTo(startOffset);
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
      player.play();
      setHasStarted(true);
    } catch (playbackError) {
      if (__DEV__) {
        console.warn('[SleepSounds] Failed to start playback', playbackError);
      }
      clearLockScreen();
      setError('playback_failed');
    }
  }, [
    albumTitle,
    clearLockScreen,
    hasStarted,
    player,
    startOffset,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.isLoaded,
    title,
  ]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) {
      clearLockScreen();
    }
  }, [clearLockScreen, status.didJustFinish]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        player.pause();
        clearLockScreen();
      };
    }, [clearLockScreen, player]),
  );

  const remainingSeconds = hasStarted
    ? Math.max(0, Math.ceil((status.duration || durationMinutes * 60) - status.currentTime))
    : durationMinutes * 60;

  return {
    error,
    hasStarted,
    isLoaded: status.isLoaded,
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    pause,
    play,
    remainingSeconds,
    stop,
  };
}
