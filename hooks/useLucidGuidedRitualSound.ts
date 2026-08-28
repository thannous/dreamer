import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

export const LUCID_GUIDED_RITUAL_SOUND_DURATION_MS = 1_200;
export const LUCID_GUIDED_RITUAL_SOUND_VOLUME = 0.08;

const RITUAL_SOUND = require('@/assets/lucid/audio/lucid_cue_rain_very_low.wav');

/** A brief optional ambience cue. Text and visual state always carry the instruction. */
export function useLucidGuidedRitualSound(enabled: boolean) {
  const player = useAudioPlayer(RITUAL_SOUND, {
    downloadFirst: true,
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStopTimer = useCallback(() => {
    if (stopTimer.current !== null) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  const stop = useCallback(async () => {
    clearStopTimer();
    try {
      player.pause();
      await player.seekTo(0);
    } catch {
      // Native shared objects may already be released during unmount.
    }
  }, [clearStopTimer, player]);

  /* eslint-disable react-hooks/immutability -- expo-audio player controls are mutable native handles. */
  const playTransition = useCallback(async () => {
    if (!enabled || !status.isLoaded) return false;
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await stop();
      player.loop = false;
      player.volume = LUCID_GUIDED_RITUAL_SOUND_VOLUME;
      player.play();
      stopTimer.current = setTimeout(() => {
        void stop();
      }, LUCID_GUIDED_RITUAL_SOUND_DURATION_MS);
      return true;
    } catch {
      return false;
    }
  }, [enabled, player, status.isLoaded, stop]);
  /* eslint-enable react-hooks/immutability */

  useEffect(() => () => {
    void stop();
  }, [stop]);

  return { playTransition, stop };
}
