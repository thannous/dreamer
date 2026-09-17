import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  isLocalLucidMorningVoiceUri,
  isLucidMorningVoiceNote,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';

const PLAYER_OPTIONS = {
  downloadFirst: false,
  updateInterval: 500,
} as const;

const FOREGROUND_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  interruptionMode: 'doNotMix' as const,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
};

export type LucidMorningVoicePlaybackError =
  | 'invalid_uri'
  | 'invalid_metadata'
  | 'playback_failed';

export type UseLucidMorningVoicePlayerResult = {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTimeSeconds: number;
  durationSeconds: number;
  error: LucidMorningVoicePlaybackError | null;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  replay: () => Promise<void>;
  stop: () => Promise<void>;
};

function asSeconds(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function resolveLocalPlaybackSource(note: LucidMorningVoiceNote | null): {
  source: string | null;
  error: 'invalid_uri' | 'invalid_metadata' | null;
  key: string;
} {
  if (note == null) {
    return { source: null, error: null, key: 'none' };
  }

  const uri = typeof note === 'object' && note && 'uri' in note ? note.uri : undefined;
  const local = isLocalLucidMorningVoiceUri(uri);

  if (isLucidMorningVoiceNote(note)) {
    return { source: note.uri, error: null, key: `${note.id}:${note.uri}` };
  }

  if (!local) {
    return { source: null, error: 'invalid_uri', key: `invalid_uri:${String(uri ?? '')}` };
  }

  return {
    source: null,
    error: 'invalid_metadata',
    key: `invalid_metadata:${String(uri ?? '')}`,
  };
}

export function useLucidMorningVoicePlayer(
  note: LucidMorningVoiceNote | null,
): UseLucidMorningVoicePlayerResult {
  const resolved = useMemo(() => resolveLocalPlaybackSource(note), [note]);
  const { source, error: validationError, key: sourceKey } = resolved;
  const player = useAudioPlayer(source, PLAYER_OPTIONS);
  const status = useAudioPlayerStatus(player);
  const [playbackError, setPlaybackError] = useState<{
    key: string;
    reason: 'playback_failed';
  } | null>(
    null,
  );
  const finishedRef = useRef(false);

  const hasSource = source !== null;
  const isLoaded = hasSource && status.isLoaded;
  const isPlaying = hasSource && status.playing;
  const isBuffering = hasSource && status.isBuffering;
  const currentTimeSeconds = hasSource ? asSeconds(status.currentTime) : 0;
  const durationSeconds = hasSource ? asSeconds(status.duration) : 0;
  const error = validationError ?? (playbackError?.key === sourceKey ? playbackError.reason : null);

  const hasReachedEnd = useCallback(() => {
    const duration = asSeconds(status.duration);
    return (
      finishedRef.current ||
      status.didJustFinish ||
      (duration > 0 && asSeconds(status.currentTime) >= duration)
    );
  }, [status.currentTime, status.didJustFinish, status.duration]);

  const failPlayback = useCallback(() => {
    setPlaybackError({ key: sourceKey, reason: 'playback_failed' });
  }, [sourceKey]);

  const bestEffortPause = useCallback(() => {
    try {
      player.pause();
    } catch {
      // The native player may already have been released during route cleanup.
    }
  }, [player]);

  const bestEffortStop = useCallback(async () => {
    try {
      player.pause();
      await player.seekTo(0);
    } catch {
      // The native player may already have been released during route cleanup.
    }
  }, [player]);

  useEffect(() => {
    finishedRef.current = false;
  }, [sourceKey]);

  useEffect(() => {
    if (
      status.didJustFinish ||
      (asSeconds(status.duration) > 0 &&
        asSeconds(status.currentTime) >= asSeconds(status.duration))
    ) {
      finishedRef.current = true;
    }
  }, [sourceKey, status.currentTime, status.didJustFinish, status.duration]);

  /* eslint-disable react-hooks/immutability -- expo-audio player controls are mutable native handles. */
  const play = useCallback(async () => {
    if (!source || validationError || !status.isLoaded) return;

    try {
      await setAudioModeAsync(FOREGROUND_AUDIO_MODE);
      player.loop = false;
      if (hasReachedEnd()) {
        await player.seekTo(0);
        finishedRef.current = false;
      }
      player.play();
      setPlaybackError(null);
    } catch {
      failPlayback();
    }
  }, [failPlayback, hasReachedEnd, player, source, status.isLoaded, validationError]);

  const replay = useCallback(async () => {
    if (!source || validationError || !status.isLoaded) return;

    try {
      await setAudioModeAsync(FOREGROUND_AUDIO_MODE);
      player.loop = false;
      await player.seekTo(0);
      finishedRef.current = false;
      player.play();
      setPlaybackError(null);
    } catch {
      failPlayback();
    }
  }, [failPlayback, player, source, status.isLoaded, validationError]);
  /* eslint-enable react-hooks/immutability */

  const pause = useCallback(async () => {
    if (!source) return;
    try {
      player.pause();
    } catch {
      failPlayback();
    }
  }, [failPlayback, player, source]);

  const stop = useCallback(async () => {
    if (!source) return;
    try {
      player.pause();
      await player.seekTo(0);
      finishedRef.current = false;
    } catch {
      failPlayback();
    }
  }, [failPlayback, player, source]);

  useEffect(() => {
    if (!source) return undefined;
    return () => {
      void bestEffortStop();
    };
  }, [bestEffortStop, source, sourceKey]);

  useEffect(() => {
    if (!source) return undefined;
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'inactive' || state === 'background') {
        bestEffortPause();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [bestEffortPause, source]);

  return {
    isLoaded,
    isPlaying,
    isBuffering,
    currentTimeSeconds,
    durationSeconds,
    error,
    play,
    pause,
    replay,
    stop,
  };
}
