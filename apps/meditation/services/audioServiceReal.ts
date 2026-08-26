import { Asset } from 'expo-asset';
import {
  createAudioPlayer,
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioPlaylistStatus,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';

/**
 * The only place `expo-audio` is touched. Everything above it talks to this
 * interface, which is what lets the mock stand in for E2E and for development
 * without any audio files.
 */
export type PlayerHandle = AudioPlayer;

/**
 * Set once, before anything plays.
 *
 * `shouldPlayInBackground` is the whole point of the app: a guided session that
 * stops when the screen locks is useless. `playsInSilentMode` matters just as
 * much — people put their phone on silent precisely when going to bed.
 */
export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  });
}

function assetFromSource(source: AudioSource): Asset | null {
  if (source == null) return null;
  if (typeof source === 'number') return Asset.fromModule(source);
  if (typeof source === 'string') return Asset.fromURI(source);
  if (typeof source === 'object') {
    if ('assetId' in source && typeof source.assetId === 'number') {
      return Asset.fromModule(source.assetId);
    }
    if ('uri' in source && typeof source.uri === 'string') {
      return Asset.fromURI(source.uri);
    }
  }
  return null;
}

/**
 * Cache a packager or remote source to a file URI before native playback.
 * Metro `http://localhost:8081` URIs die as soon as the bundler is gone;
 * expo-asset keeps the file after the first successful download.
 */
export async function resolvePlayableSource(source: AudioSource): Promise<AudioSource> {
  const asset = assetFromSource(source);
  if (!asset) {
    if (source == null) {
      throw new Error('Audio source is missing');
    }
    return source;
  }

  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('Audio source could not be cached');
  }

  if (source && typeof source === 'object') {
    return { ...source, uri: asset.localUri };
  }
  return { uri: asset.localUri };
}

export function createPlayer(source: AudioSource, updateIntervalMs = 500): PlayerHandle {
  const player = createAudioPlayer(source, { updateInterval: updateIntervalMs });
  return player;
}

type SessionPlayerHandle = {
  currentTime: number;
  duration: number;
  playing: boolean;
  volume: number;
  loop: boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  addListener(
    eventName: 'playbackStatusUpdate',
    listener: (status: AudioStatus) => void
  ): { remove(): void };
  remove(): void;
};

/**
 * A session is a playlist of the same five-minute world texture. Expo keeps
 * the audio native and gapless while this adapter exposes one continuous
 * timeline to PlayerContext.
 */
export function createSessionPlayer(
  source: AudioSource,
  durationSec: number,
  trackDurationSec: number,
  updateIntervalMs = 500
): SessionPlayerHandle {
  const safeTrackDuration = Math.max(1, trackDurationSec);
  const safeDuration = Math.max(1, durationSec);
  const trackCount = Math.max(1, Math.ceil(safeDuration / safeTrackDuration));
  const playlist = createAudioPlaylist({
    sources: Array.from({ length: trackCount }, () => source),
    updateInterval: updateIntervalMs,
    loop: 'none',
  });
  let finished = false;

  const playlistError = (status: AudioPlaylistStatus): string | null => {
    const error = (status as AudioPlaylistStatus & {
      error?: string | { message?: string | null } | null;
    }).error;
    if (!error) return null;
    if (typeof error === 'string') return error;
    return error.message ?? 'Audio playback failed';
  };

  const globalTime = (status: AudioPlaylistStatus): number =>
    Math.min(
      safeDuration,
      status.currentIndex * safeTrackDuration + status.currentTime
    );

  const toStatus = (
    status: AudioPlaylistStatus,
    reachedSessionEnd = false
  ): AudioStatus => ({
    id: status.id,
    currentTime: globalTime(status),
    playbackState: status.playing && !reachedSessionEnd ? 'playing' : 'paused',
    timeControlStatus: status.isBuffering
      ? 'waiting'
      : status.playing && !reachedSessionEnd
        ? 'playing'
        : 'paused',
    reasonForWaitingToPlay: status.isBuffering ? 'buffering' : '',
    mute: status.muted,
    duration: safeDuration,
    playing: status.playing && !reachedSessionEnd,
    loop: status.loop !== 'none',
    didJustFinish: reachedSessionEnd,
    isBuffering: status.isBuffering,
    isLoaded: status.isLoaded,
    playbackRate: status.playbackRate,
    shouldCorrectPitch: true,
    isLive: false,
    currentOffsetFromLive: null,
    error: playlistError(status),
  });

  return {
    get currentTime() {
      return globalTime(playlist.currentStatus);
    },
    get duration() {
      return safeDuration;
    },
    get playing() {
      return playlist.playing;
    },
    get volume() {
      return playlist.volume;
    },
    set volume(value: number) {
      playlist.volume = value;
    },
    get loop() {
      return playlist.loop !== 'none';
    },
    set loop(value: boolean) {
      playlist.loop = value ? 'all' : 'none';
    },
    play: () => playlist.play(),
    pause: () => playlist.pause(),
    async seekTo(seconds: number) {
      const target = Math.min(Math.max(seconds, 0), safeDuration);
      const index = Math.min(trackCount - 1, Math.floor(target / safeTrackDuration));
      const localTime = target - index * safeTrackDuration;
      if (playlist.currentIndex !== index) playlist.skipTo(index);
      await playlist.seekTo(localTime);
    },
    setPlaybackRate: (rate: number) => {
      playlist.playbackRate = rate;
    },
    addListener(_eventName, listener) {
      return playlist.addListener('playlistStatusUpdate', (status) => {
        const reachedSessionEnd = globalTime(status) >= safeDuration;
        const didFinishNow = reachedSessionEnd && !finished;
        if (didFinishNow) {
          finished = true;
          playlist.pause();
        } else if (!reachedSessionEnd) {
          finished = false;
        }
        listener(toStatus(status, didFinishNow));
      });
    },
    remove: () => playlist.destroy(),
  };
}

export const play = (player: PlayerHandle): void => player.play();
export const pause = (player: PlayerHandle): void => player.pause();
export const seekTo = (player: PlayerHandle, seconds: number): Promise<void> =>
  player.seekTo(seconds);
export const setRate = (player: PlayerHandle, rate: number): void =>
  player.setPlaybackRate(rate);
export const setVolume = (player: PlayerHandle, volume: number): void => {
  player.volume = volume;
};
export const setLoop = (player: PlayerHandle, loop: boolean): void => {
  player.loop = loop;
};
export const release = (player: PlayerHandle): void => player.remove();
