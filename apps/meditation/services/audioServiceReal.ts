import { Asset } from 'expo-asset';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';

/**
 * The only place `expo-audio` is touched. Everything above it talks to this
 * interface, which is what lets the mock stand in for E2E and for development
 * without any audio files.
 */
export type PlayerHandle = AudioPlayer;

export type SessionLockScreenMetadata = {
  title: string;
  artist?: string;
  albumTitle?: string;
};

/**
 * Set once, before anything plays.
 *
 * `shouldPlayInBackground` is the whole point of the app: a guided session that
 * stops when the screen locks is useless. `playsInSilentMode` matters just as
 * much — people put their phone on silent precisely when going to bed.
 * `doNotMix` is required for lock-screen controls to stay attached to us.
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

function nativePosition(sessionTime: number, trackDuration: number): number {
  if (trackDuration <= 0) return 0;
  const local = sessionTime % trackDuration;
  return local === 0 && sessionTime > 0 ? 0 : local;
}

/**
 * A session is one looping five-minute world texture. Expo owns the native
 * loop and lock-screen controls; this adapter exposes a continuous virtual
 * timeline to PlayerContext so a 10-minute séance can sit on a 5-minute file.
 */
export function createSessionPlayer(
  source: AudioSource,
  durationSec: number,
  trackDurationSec: number,
  updateIntervalMs = 500,
  lockScreen?: SessionLockScreenMetadata
): SessionPlayerHandle {
  const safeTrackDuration = Math.max(1, trackDurationSec);
  const safeDuration = Math.max(1, durationSec);
  const player = createAudioPlayer(source, {
    updateInterval: updateIntervalMs,
    keepAudioSessionActive: true,
  });
  player.loop = true;

  let finished = false;
  let loopIndex = 0;
  let lastNativeTime = 0;
  let sessionOffset = 0;
  let playStartedAt: number | null = null;
  let lockScreenActive = false;
  let lastNativePlaying = player.playing;
  const loopEdgeWindowSec = Math.max(2, (updateIntervalMs / 1_000) * 4);

  const metadata: AudioMetadata = {
    title: lockScreen?.title ?? 'Noctalia Meditation',
    artist: lockScreen?.artist ?? 'Noctalia Meditation',
    albumTitle: lockScreen?.albumTitle,
  };

  const activateLockScreen = () => {
    if (typeof player.setActiveForLockScreen !== 'function') return;
    player.setActiveForLockScreen(true, metadata, {
      showSeekForward: false,
      showSeekBackward: false,
      isLiveStream: true,
    });
    lockScreenActive = true;
  };

  const deactivateLockScreen = () => {
    if (!lockScreenActive) return;
    // Android expo-audio 57.0.4: clearLockScreenControls() unregisters the
    // service player but leaves isActiveForLockScreen true when the binder is
    // missing, so the paused media session and NO_CLEAR notification survive
    // close. setActiveForLockScreen(false) always drops that native flag.
    if (typeof player.setActiveForLockScreen === 'function') {
      player.setActiveForLockScreen(false);
    }
    if (typeof player.clearLockScreenControls === 'function') {
      player.clearLockScreenControls();
    }
    lockScreenActive = false;
  };

  const mappedSessionTime = (nativeTime: number): number => {
    // Count only a real end-to-start wrap. Audio focus loss can briefly expose
    // currentTime=0; treating any backward jump as a loop adds five minutes.
    if (
      lastNativeTime >= safeTrackDuration - loopEdgeWindowSec &&
      nativeTime <= loopEdgeWindowSec
    ) {
      loopIndex += 1;
    }
    lastNativeTime = nativeTime;
    return Math.min(safeDuration, loopIndex * safeTrackDuration + nativeTime);
  };

  const nowSessionTime = (nativeTime?: number): number => {
    if (finished) return safeDuration;
    // A native interruption can pause the handle without a JS callback.
    // Freeze from the native player so a later getter does not keep adding
    // wall-clock time from the other app's playback.
    if (!player.playing && playStartedAt != null) {
      const mappedPause = mappedSessionTime(nativeTime ?? player.currentTime);
      sessionOffset = Math.min(safeDuration, Math.max(sessionOffset, mappedPause));
      playStartedAt = null;
      return sessionOffset;
    }
    const mapped =
      nativeTime == null
        ? Math.min(safeDuration, sessionOffset)
        : mappedSessionTime(nativeTime);
    if (playStartedAt == null) return Math.min(safeDuration, mapped);
    const wall = sessionOffset + (Date.now() - playStartedAt) / 1000;
    return Math.min(safeDuration, Math.max(mapped, wall));
  };

  const freezeClock = (nativeTime?: number) => {
    sessionOffset = nowSessionTime(nativeTime);
    playStartedAt = null;
  };

  const startClock = (nativeTime?: number) => {
    sessionOffset = nowSessionTime(nativeTime);
    playStartedAt = Date.now();
  };

  const toStatus = (status: AudioStatus, reachedSessionEnd: boolean, currentTime: number): AudioStatus => ({
    ...status,
    currentTime,
    duration: safeDuration,
    playbackState: status.playing && !reachedSessionEnd ? 'playing' : 'paused',
    timeControlStatus: status.isBuffering
      ? 'waiting'
      : status.playing && !reachedSessionEnd
        ? 'playing'
        : 'paused',
    playing: status.playing && !reachedSessionEnd,
    loop: false,
    didJustFinish: reachedSessionEnd,
    isLive: false,
    currentOffsetFromLive: null,
  });

  activateLockScreen();

  return {
    get currentTime() {
      return nowSessionTime();
    },
    get duration() {
      return safeDuration;
    },
    get playing() {
      return player.playing && !finished;
    },
    get volume() {
      return player.volume;
    },
    set volume(value: number) {
      player.volume = value;
    },
    get loop() {
      return false;
    },
    set loop(_value: boolean) {
      player.loop = !finished;
    },
    play: () => {
      if (finished) return;
      startClock();
      player.loop = true;
      player.play();
      lastNativePlaying = true;
      activateLockScreen();
    },
    pause: () => {
      freezeClock();
      player.pause();
      lastNativePlaying = false;
    },
    async seekTo(seconds: number) {
      const target = Math.min(Math.max(seconds, 0), safeDuration);
      if (target >= safeDuration) {
        finished = true;
        playStartedAt = null;
        sessionOffset = safeDuration;
        player.loop = false;
        player.pause();
        deactivateLockScreen();
        return;
      }
      finished = false;
      loopIndex = Math.min(
        Math.floor(target / safeTrackDuration),
        Math.max(0, Math.ceil(safeDuration / safeTrackDuration) - 1)
      );
      lastNativeTime = nativePosition(target, safeTrackDuration);
      sessionOffset = target;
      if (playStartedAt != null) playStartedAt = Date.now();
      player.loop = true;
      await player.seekTo(lastNativeTime);
    },
    setPlaybackRate: (rate: number) => {
      player.setPlaybackRate(rate);
    },
    addListener(_eventName, listener) {
      return player.addListener('playbackStatusUpdate', (status) => {
        if (finished) {
          listener(toStatus(status, true, safeDuration));
          return;
        }

        const currentTime = nowSessionTime(status.currentTime);
        const reachedSessionEnd = currentTime >= safeDuration;
        const didFinishNow = reachedSessionEnd && !finished;
        const wasNativePlaying = lastNativePlaying;
        lastNativePlaying = status.playing && !reachedSessionEnd;
        if (didFinishNow) {
          finished = true;
          lastNativePlaying = false;
          playStartedAt = null;
          sessionOffset = safeDuration;
          player.loop = false;
          player.pause();
          deactivateLockScreen();
        } else if (status.playing) {
          sessionOffset = currentTime;
          playStartedAt = Date.now();
          // Android can auto-resume ExoPlayer after a transient audio-focus
          // loss while Media3 keeps exposing the stale PAUSED session. Expo's
          // activation call rebuilds that service session from ref.isPlaying.
          // Refresh only on the native paused -> playing edge: doing this on
          // every 500 ms status tick would churn the notification and binder.
          if (!wasNativePlaying && lockScreenActive) {
            activateLockScreen();
          }
        } else {
          sessionOffset = currentTime;
          playStartedAt = null;
        }
        listener(toStatus(status, didFinishNow, currentTime));
      });
    },
    remove: () => {
      playStartedAt = null;
      deactivateLockScreen();
      player.remove();
    },
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
