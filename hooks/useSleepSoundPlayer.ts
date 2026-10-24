import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  type SleepSoundConfig,
  type SleepTimerMinutes,
} from '@/lib/sleepSounds';
import { endSleepTimer, showSleepTimer } from '@/services/noctaliaWidgets';
import { ensureSleepSoundFile } from '@/services/sleepSoundFiles';

const SLEEP_SOUND_VOLUME = 0.65;
const TIMER_UPDATE_INTERVAL_MS = 500;
/** The last minute of a session fades the sound out instead of cutting it. */
const FADE_OUT_MS = 60_000;
/**
 * A loop the player still cannot open after this long (a stream that never arrives on
 * web, an unreadable file) is reported like a failed download, so the screen offers a
 * retry instead of an endless "preparing" state. Stalled downloads are cut by
 * `ensureSleepSoundFile` itself.
 */
const SOURCE_LOAD_TIMEOUT_MS = 30_000;
/**
 * A loop that was playing and then drops out of the player (an Android decoder error)
 * is reported after this short grace period, as an interruption rather than a download.
 */
const PLAYBACK_LOSS_GRACE_MS = 3_000;

type SourceFailure = { key: string; kind: 'download' | 'playback' };

function getSessionVolume(remainingMs: number) {
  return SLEEP_SOUND_VOLUME * Math.min(1, Math.max(0, remainingMs) / FADE_OUT_MS);
}

type UseSleepSoundPlayerOptions = {
  sound: SleepSoundConfig;
  durationMinutes: SleepTimerMinutes;
  title: string;
  albumTitle: string;
  /**
   * The words beside the countdown on the lock screen and in the Dynamic Island, while the
   * sound plays and while it is paused. Without them (Lucid), no countdown leaves the app.
   */
  lockScreenTimer?: { caption: string; paused: string };
};

export function useSleepSoundPlayer({
  sound,
  durationMinutes,
  title,
  albumTitle,
  lockScreenTimer,
}: UseSleepSoundPlayerOptions) {
  const [resolved, setResolved] = useState<{ id: string; uri: string } | null>(null);
  const [downloadAttempt, setDownloadAttempt] = useState(0);
  const [failure, setFailure] = useState<SourceFailure | null>(null);
  const playAfterDownloadRef = useRef<string | null>(null);
  // The download attempt the listener actually heard; cleared by Stop.
  const [playedKey, setPlayedKey] = useState<string | null>(null);
  const downloadKey = `${sound.id}:${downloadAttempt}`;
  const sourceUri = resolved?.id === sound.id ? resolved.uri : null;
  const streamsOnWeb = Platform.OS === 'web';
  const player = useAudioPlayer(!streamsOnWeb && sourceUri ? { uri: sourceUri } : null, {
    downloadFirst: !streamsOnWeb,
    updateInterval: 500,
  });
  // Web streams directly: Expo's download-first preload rejects without a catch
  // when the network fails. Keep its player identity stable across source/retry
  // changes so focus cleanup cannot cancel a pending request to listen.
  useEffect(() => {
    if (streamsOnWeb) player.replace(sourceUri ? { uri: sourceUri } : null);
  }, [player, sourceUri, streamsOnWeb]);
  const status = useAudioPlayerStatus(player);
  const isPlayable = Boolean(sourceUri) && status.isLoaded;
  // A source that loads after the timeout clears the error on its own.
  // A late load retires the failure, so a later dropout is classified afresh.
  if (isPlayable && failure?.key === downloadKey) setFailure(null);
  const sourceFailed = failure?.key === downloadKey && !isPlayable;
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ensureSleepSoundFile(sound).then(
      (uri) => {
        if (active) setResolved({ id: sound.id, uri });
      },
      (downloadError: unknown) => {
        if (__DEV__) {
          console.warn('[SleepSounds] Failed to download the loop', downloadError);
        }
        if (active) setFailure({ key: downloadKey, kind: 'download' });
      },
    );
    return () => {
      active = false;
    };
  }, [downloadKey, sound]);

  useEffect(() => {
    if (!sourceUri || isPlayable || sourceFailed) return;
    // The file is on the phone once it has played: losing it now is a playback problem.
    const kind = playedKey === downloadKey ? 'playback' : 'download';
    const timeoutId = setTimeout(
      () => setFailure({ key: downloadKey, kind }),
      kind === 'playback' ? PLAYBACK_LOSS_GRACE_MS : SOURCE_LOAD_TIMEOUT_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [downloadKey, isPlayable, playedKey, sourceFailed, sourceUri]);
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  // Heard means playing within a session: Stop ends the session before the native
  // status catches up, so a stale `playing` cannot mark the attempt again.
  if (status.playing && timerRunning && isPlayable && playedKey !== downloadKey) {
    setPlayedKey(downloadKey);
  }
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
    playAfterDownloadRef.current = null;
    player.pause();
    clearLockScreen();
    const sessionDurationSeconds = durationMinutes * 60;
    remainingMsRef.current = sessionDurationSeconds * 1000;
    startedAtMsRef.current = null;
    setRemainingSeconds(sessionDurationSeconds);
    setTimerRunning(false);
    setHasStarted(false);
    setPlayedKey(null);
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
    if (sourceFailed) {
      // Try the download again; a retry is a request to listen, so play once it is ready.
      playAfterDownloadRef.current = sound.id;
      // Drop the current source first, so a loop that timed out while loading is
      // handed to the player again even when the retry resolves to the same file.
      setResolved(null);
      setDownloadAttempt((attempt) => attempt + 1);
      return;
    }
    if (!sourceUri || !status.isLoaded) return;

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

      const shouldRestart = !hasStarted || remainingMsRef.current <= 0;
      if (shouldRestart) {
        const sessionDurationSeconds = durationMinutes * 60;
        remainingMsRef.current = sessionDurationSeconds * 1000;
        setRemainingSeconds(sessionDurationSeconds);
        await player.seekTo(0);
      }
      player.volume = getSessionVolume(remainingMsRef.current);

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
    sound.id,
    sourceFailed,
    sourceUri,
    status.isLoaded,
    title,
  ]);

  // The sound starts by itself once a retried download is ready, unless Stop came first.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    const pending = playAfterDownloadRef.current;
    if (pending === null || !isPlayable) return;
    playAfterDownloadRef.current = null;
    if (pending === sound.id) void play();
  }, [isPlayable, play, sound.id]);

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
      if (nextRemainingMs < FADE_OUT_MS) {
        try {
          // eslint-disable-next-line react-hooks/immutability
          player.volume = getSessionVolume(nextRemainingMs);
        } catch {
          // The native player may already have been released during route cleanup.
        }
      }
      setRemainingSeconds(Math.ceil(nextRemainingMs / 1000));
    };

    updateTimer();
    const timerId = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [finishSession, getRemainingMs, player, timerRunning]);

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

  // The countdown on the lock screen and in the Dynamic Island follows the session: there
  // while it plays or pauses, gone once it stops, runs out, or the screen is left (the
  // sound stops with it). The system counts down; it hears only of a pause or a resume.
  const focusedRef = useRef(false);
  const timerCaption = lockScreenTimer?.caption;
  const timerPaused = lockScreenTimer?.paused;
  useEffect(() => {
    if (timerCaption === undefined || timerPaused === undefined) return;
    if (!focusedRef.current || !hasStarted || remainingMsRef.current <= 0) {
      endSleepTimer();
      return;
    }
    showSleepTimer({
      sound: title,
      caption: timerRunning ? timerCaption : timerPaused,
      remainingMs: getRemainingMs(),
      paused: !timerRunning,
    });
  }, [getRemainingMs, hasStarted, timerCaption, timerPaused, timerRunning, title]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        // A paused session changes no state here, so the effect above would not hear of it.
        focusedRef.current = false;
        endSleepTimer();
        // Leaving the screen also cancels a retry that was waiting to start the sound.
        playAfterDownloadRef.current = null;
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
    error: sourceFailed
      ? failure?.kind === 'playback'
        ? 'playback_interrupted'
        : 'download_failed'
      : error,
    hasStarted,
    isLoaded: isPlayable,
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    pause,
    play,
    remainingSeconds: hasStarted ? remainingSeconds : durationMinutes * 60,
    stop,
  };
}
