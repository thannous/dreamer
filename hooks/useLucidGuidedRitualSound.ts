import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

export const LUCID_GUIDED_RITUAL_SOUND_DURATION_MS = 1_200;
export const LUCID_GUIDED_RITUAL_SOUND_VOLUME = 0.08;

const RITUAL_SOUND = require('@/assets/lucid/audio/lucid_cue_rain_very_low.wav');

/** A brief optional ambience cue. Text and visual state always carry the instruction. */
export function useLucidGuidedRitualSound(
  enabled: boolean,
  onUnexpectedInterruption?: () => void
) {
  const player = useAudioPlayer(RITUAL_SOUND, {
    downloadFirst: true,
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUnexpectedInterruptionRef = useRef(onUnexpectedInterruption);
  const expectingPlaybackRef = useRef(false);
  const observedPlayingRef = useRef(false);
  const controlledStopRef = useRef(false);
  const notifiedRef = useRef(false);
  const previousPlayingRef = useRef(false);
  const previousMediaResetRef = useRef(false);

  useEffect(() => {
    onUnexpectedInterruptionRef.current = onUnexpectedInterruption;
  }, [onUnexpectedInterruption]);

  const clearStopTimer = useCallback(() => {
    if (stopTimer.current !== null) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  const stop = useCallback(async () => {
    clearStopTimer();
    controlledStopRef.current = true;
    expectingPlaybackRef.current = false;
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
      expectingPlaybackRef.current = true;
      observedPlayingRef.current = false;
      notifiedRef.current = false;
      controlledStopRef.current = false;
      previousPlayingRef.current = false;
      stopTimer.current = setTimeout(() => {
        void stop();
      }, LUCID_GUIDED_RITUAL_SOUND_DURATION_MS);
      return true;
    } catch {
      expectingPlaybackRef.current = false;
      observedPlayingRef.current = false;
      controlledStopRef.current = true;
      return false;
    }
  }, [enabled, player, status.isLoaded, stop]);
  /* eslint-enable react-hooks/immutability */

  useEffect(() => {
    const playing = status.playing === true;
    const finished = status.didJustFinish === true;
    const mediaReset = status.mediaServicesDidReset === true;
    const mediaResetJustHappened = mediaReset && !previousMediaResetRef.current;

    if (expectingPlaybackRef.current && playing) {
      observedPlayingRef.current = true;
    }

    const playbackObservedAndExpected =
      expectingPlaybackRef.current && observedPlayingRef.current;
    const unexpectedPauseBeforeEnd =
      previousPlayingRef.current && !playing && !finished;
    const shouldNotify =
      playbackObservedAndExpected &&
      enabled &&
      !controlledStopRef.current &&
      !notifiedRef.current &&
      (mediaResetJustHappened || unexpectedPauseBeforeEnd);

    if (finished) {
      expectingPlaybackRef.current = false;
    }

    if (shouldNotify) {
      notifiedRef.current = true;
      expectingPlaybackRef.current = false;
      void stop();
      onUnexpectedInterruptionRef.current?.();
    }

    previousPlayingRef.current = playing;
    previousMediaResetRef.current = mediaReset;
  }, [
    enabled,
    status.didJustFinish,
    status.mediaServicesDidReset,
    status.playing,
    stop,
  ]);

  useEffect(() => {
    if (!enabled && expectingPlaybackRef.current) {
      void stop();
    }
  }, [enabled, stop]);

  useEffect(() => () => {
    void stop();
  }, [stop]);

  return { playTransition, stop };
}
