import { useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { SESSION_BY_ID } from '@/content/sessions';
import {
  WORLD_SOUND_BY_ID,
  WORLD_SOUND_TRACK_DURATION_SEC,
} from '@/content/worldSounds';
import { DEFAULT_WORLD_ID, type WorldId } from '@/constants/worlds';
import { useLibrary } from '@/context/LibraryContext';
import { useTranslation } from '@/context/LanguageContext';
import {
  clampSeek,
  effectiveDuration,
  fadeVolume,
  isPractised,
  seekBy as seekByPure,
  SEEK_STEP_SEC,
  type FadeTimerMinutes,
} from '@/lib/audio';
import type { TranslationKey } from '@/lib/i18n';
import { RESUME_MAX_RATIO, type MeditationSession, type SessionId } from '@/lib/types';
import * as audio from '@/services/audioService';

/** How often the listening position is written to storage. */
const PERSIST_EVERY_SEC = 5;
const NATIVE_STATUS_SYNC_MS = 500;
/** Ignore native ticks that still report the pre-seek position. */
const SEEK_SETTLE_SEC = 1.5;

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

type PlayerContextValue = {
  session: MeditationSession | null;
  worldId: WorldId | null;
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  soundEnabled: boolean;
  fadeMinutes: FadeTimerMinutes | null;
  /** Seconds left on the fade timer, or null when none is running. */
  fadeRemainingSec: number | null;
  open: (sessionId: SessionId, startAtSec?: number, worldId?: WorldId) => void;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  skip: (deltaSec: number) => void;
  toggleSound: () => void;
  setFadeTimer: (minutes: FadeTimerMinutes | null) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const { recordProgress, recordPractice } = useLibrary();
  const { t } = useTranslation();

  const [session, setSession] = useState<MeditationSession | null>(null);
  const [worldId, setWorldId] = useState<WorldId | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [positionSec, setPositionSec] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fadeMinutes, setFadeMinutes] = useState<FadeTimerMinutes | null>(null);
  const [fadeRemainingSec, setFadeRemaining] = useState<number | null>(null);

  const playerRef = useRef<audio.PlayerHandle | null>(null);
  const textureRef = useRef<audio.PlayerHandle | null>(null);
  const primaryVolumeRef = useRef(0);
  const textureVolumeRef = useRef(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const lastPersistedRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const practisedLoggedRef = useRef(false);
  const openGenerationRef = useRef(0);
  const statusRef = useRef<PlayerStatus>('idle');
  const sessionRef = useRef<MeditationSession | null>(null);
  const positionSecRef = useRef(0);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    audio.configureAudioSession().catch(() => {
      // An audio session that refuses to configure still plays, just without
      // background or silent-mode behaviour. Not worth blocking on.
    });
  }, []);

  const teardown = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (playerRef.current) {
      audio.release(playerRef.current);
      playerRef.current = null;
    }
    if (textureRef.current) {
      audio.release(textureRef.current);
      textureRef.current = null;
    }
    primaryVolumeRef.current = 0;
    textureVolumeRef.current = 0;
  }, []);

  useEffect(() => teardown, [teardown]);

  const durationSec = effectiveDuration(loadedDuration, session?.durationSec ?? 0);

  const persist = useCallback(
    (sessionId: SessionId, positionValue: number, completed = false) => {
      recordProgress(sessionId, Math.round(positionValue), completed).catch(() => {});
    },
    [recordProgress]
  );
  const persistRef = useRef(persist);

  const resetIdleState = useCallback(() => {
    statusRef.current = 'idle';
    sessionRef.current = null;
    setSession(null);
    setWorldId(null);
    setStatus('idle');
    positionSecRef.current = 0;
    setPositionSec(0);
    pendingSeekRef.current = null;
    setFadeMinutes(null);
    setFadeRemaining(null);
  }, []);

  const open = useCallback(
    (sessionId: SessionId, startAtSec = 0, openedWorldId?: WorldId) => {
      const next = SESSION_BY_ID[sessionId];
      if (!next) return;

      // Replay must start at 0. A finished session still stores its last
      // second, and that saved position would otherwise reopen a dead loop.
      const requestedStart = Number.isFinite(startAtSec) ? Math.max(0, startAtSec) : 0;
      const startAt =
        next.durationSec > 0 && requestedStart / next.durationSec > RESUME_MAX_RATIO
          ? 0
          : requestedStart;

      const generation = ++openGenerationRef.current;
      teardown();
      completedRef.current = false;
      practisedLoggedRef.current = false;
      pendingSeekRef.current = null;
      lastPersistedRef.current = startAt;
      setSession(next);
      sessionRef.current = next;
      const resolvedWorldId = openedWorldId ?? DEFAULT_WORLD_ID;
      const sound = WORLD_SOUND_BY_ID[resolvedWorldId];

      setWorldId(resolvedWorldId);
      setPositionSec(startAt);
      positionSecRef.current = startAt;
      setLoadedDuration(0);
      setFadeMinutes(null);
      setFadeRemaining(null);
      statusRef.current = 'loading';
      setStatus('loading');
      primaryVolumeRef.current = sound.primary.volume;
      textureVolumeRef.current = sound.secondary?.volume ?? 0;

      void (async () => {
        try {
          const primarySource = await audio.resolvePlayableSource(sound.primary.source);
          const textureSource = sound.secondary
            ? await audio.resolvePlayableSource(sound.secondary.source)
            : null;
          if (generation !== openGenerationRef.current) return;

          const player = audio.createSessionPlayer(
            primarySource,
            next.durationSec,
            WORLD_SOUND_TRACK_DURATION_SEC,
            500,
            {
              title: t(`session.${next.id}.title` as TranslationKey),
              artist: 'Noctalia Meditation',
              albumTitle: t(`world.${resolvedWorldId}.name` as TranslationKey),
            }
          );
          audio.setVolume(player, soundEnabled ? sound.primary.volume : 0);

          let texture = null;
          if (textureSource && sound.secondary) {
            texture = audio.createPlayer(textureSource, 1_000);
            audio.setLoop(texture, true);
            audio.setRate(texture, sound.secondary.rate);
            audio.setVolume(texture, sound.secondary.volume);
          }

          if (generation !== openGenerationRef.current) {
            audio.release(player);
            if (texture) audio.release(texture);
            return;
          }

          playerRef.current = player;
          textureRef.current = texture;

          subscriptionRef.current = player.addListener('playbackStatusUpdate', (statusUpdate) => {
            if (statusUpdate.error) {
              if (textureRef.current) audio.pause(textureRef.current);
              statusRef.current = 'unavailable';
              setStatus('unavailable');
              return;
            }
            const pendingSeek = pendingSeekRef.current;
            if (
              pendingSeek !== null &&
              Math.abs(statusUpdate.currentTime - pendingSeek) > SEEK_SETTLE_SEC
            ) {
              const nextStatus: PlayerStatus = statusUpdate.playing ? 'playing' : 'paused';
              statusRef.current = nextStatus;
              setStatus(nextStatus);
              setLoadedDuration(statusUpdate.duration);
              if (textureRef.current) {
                if (statusUpdate.playing && !statusUpdate.didJustFinish && soundEnabledRef.current) {
                  audio.play(textureRef.current);
                } else {
                  audio.pause(textureRef.current);
                }
              }
              return;
            }
            if (pendingSeek !== null) {
              pendingSeekRef.current = null;
            }
            setLoadedDuration(statusUpdate.duration);
            setPositionSec(statusUpdate.currentTime);
            positionSecRef.current = statusUpdate.currentTime;
            const nextStatus: PlayerStatus = statusUpdate.playing ? 'playing' : 'paused';
            statusRef.current = nextStatus;
            setStatus(nextStatus);
            if (textureRef.current) {
              if (statusUpdate.playing && !statusUpdate.didJustFinish && soundEnabledRef.current) {
                audio.play(textureRef.current);
              } else {
                audio.pause(textureRef.current);
              }
            }

            if (statusUpdate.currentTime - lastPersistedRef.current >= PERSIST_EVERY_SEC) {
              lastPersistedRef.current = statusUpdate.currentTime;
              persist(next.id, statusUpdate.currentTime);
            }

            const total = effectiveDuration(statusUpdate.duration, next.durationSec);
            if (isPractised(statusUpdate.currentTime, total)) {
              if (!completedRef.current) {
                completedRef.current = true;
                persist(next.id, statusUpdate.currentTime, true);
              }
              if (!practisedLoggedRef.current) {
                practisedLoggedRef.current = true;
                recordPractice({
                  sessionId: next.id,
                  seconds: Math.round(statusUpdate.currentTime),
                }).catch(() => {});
              }
            }

            if (statusUpdate.didJustFinish) {
              if (!completedRef.current) {
                completedRef.current = true;
                persist(next.id, statusUpdate.currentTime, true);
              }
              if (generation !== openGenerationRef.current) return;
              const worldParam = `&worldId=${resolvedWorldId}`;
              router.replace(`/session-complete?id=${next.id}${worldParam}`);
              // Release after the native finish: session-complete has no
              // transport, and a leftover looping handle would keep lock-screen
              // controls or a mini-player for a session that already ended.
              openGenerationRef.current += 1;
              teardown();
              resetIdleState();
            }
          });

          if (startAt > 0) audio.seekTo(player, startAt).catch(() => {});
          audio.play(player);
          if (soundEnabled && textureRef.current) audio.play(textureRef.current);
        } catch {
          if (generation !== openGenerationRef.current) return;
          teardown();
          statusRef.current = 'unavailable';
          setStatus('unavailable');
        }
      })();
    },
    [persist, recordPractice, resetIdleState, router, soundEnabled, t, teardown]
  );

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player || status === 'loading' || status === 'unavailable' || status === 'idle') return;

    if (status === 'playing') {
      audio.pause(player);
      statusRef.current = 'paused';
      setStatus('paused');
      if (session) persist(session.id, positionSec);
      if (textureRef.current) audio.pause(textureRef.current);
      return;
    }

    audio.play(player);
    statusRef.current = 'playing';
    setStatus('playing');
    if (soundEnabled && textureRef.current) audio.play(textureRef.current);
  }, [persist, positionSec, session, soundEnabled, status]);

  const seekTo = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      const currentSession = sessionRef.current;
      if (!player || !currentSession) return;
      const target = clampSeek(seconds, durationSec);
      pendingSeekRef.current = target;
      lastPersistedRef.current = target;
      positionSecRef.current = target;
      setPositionSec(target);
      persist(currentSession.id, target);
      audio.seekTo(player, target).catch(() => {});
    },
    [durationSec, persist]
  );

  const skip = useCallback(
    (deltaSec: number) => seekTo(seekByPure(positionSec, deltaSec, durationSec)),
    [positionSec, durationSec, seekTo]
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => {
      const next = !enabled;
      if (playerRef.current) {
        audio.setVolume(playerRef.current, next ? primaryVolumeRef.current : 0);
      }
      if (textureRef.current) {
        if (next && status === 'playing') audio.play(textureRef.current);
        else audio.pause(textureRef.current);
      }
      return next;
    });
  }, [status]);

  const setFadeTimer = useCallback((minutes: FadeTimerMinutes | null) => {
    setFadeMinutes(minutes);
    setFadeRemaining(minutes === null ? null : minutes * 60);
  }, []);

  /**
   * The fade timer.
   *
   * Its last minute ramps the volume to silence rather than cutting: someone on
   * the edge of sleep must not be pulled back by an abrupt stop.
   */
  useEffect(() => {
    if (fadeRemainingSec === null || status !== 'playing') return;

    const tick = setInterval(() => {
      setFadeRemaining((remaining) => {
        if (remaining === null) return null;
        const next = remaining - 1;

        const player = playerRef.current;
        if (player) {
          audio.setVolume(
            player,
            soundEnabled ? fadeVolume(next, primaryVolumeRef.current) : 0
          );
        }
        if (textureRef.current) {
          audio.setVolume(
            textureRef.current,
            soundEnabled ? fadeVolume(next, textureVolumeRef.current) : 0
          );
        }

        if (next <= 0) {
          if (player) audio.pause(player);
          if (textureRef.current) audio.pause(textureRef.current);
          statusRef.current = 'paused';
          setStatus('paused');
          return null;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [fadeRemainingSec === null, soundEnabled, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    openGenerationRef.current += 1;
    if (session && positionSec > 0) persist(session.id, positionSec);
    teardown();
    resetIdleState();
  }, [persist, positionSec, resetIdleState, session, teardown]);

  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const syncNativePlayback = useCallback((forcePosition = false) => {
    const player = playerRef.current;
    const currentSession = sessionRef.current;
    if (!player || !currentSession) return;
    if (statusRef.current === 'idle' || statusRef.current === 'loading') return;

    const nativePlaying = player.playing === true;
    const nextStatus: PlayerStatus = nativePlaying ? 'playing' : 'paused';
    const statusChanged = statusRef.current !== nextStatus;
    if (!statusChanged && !forcePosition) return;

    const reportedPosition = player.currentTime;
    const nativePosition = Number.isFinite(reportedPosition)
      ? Math.max(0, reportedPosition)
      : positionSecRef.current;
    const pendingSeek = pendingSeekRef.current;
    if (pendingSeek !== null && Math.abs(nativePosition - pendingSeek) > SEEK_SETTLE_SEC) {
      if (statusChanged) {
        statusRef.current = nextStatus;
        setStatus(nextStatus);
        if (textureRef.current) {
          if (nativePlaying && soundEnabledRef.current) audio.play(textureRef.current);
          else audio.pause(textureRef.current);
        }
        persistRef.current(currentSession.id, positionSecRef.current);
      }
      return;
    }
    if (pendingSeek !== null) {
      pendingSeekRef.current = null;
    }
    const positionChanged = positionSecRef.current !== nativePosition;

    positionSecRef.current = nativePosition;
    setPositionSec(nativePosition);
    statusRef.current = nextStatus;
    setStatus(nextStatus);

    if (textureRef.current) {
      if (nativePlaying && soundEnabledRef.current) audio.play(textureRef.current);
      else audio.pause(textureRef.current);
    }

    if (statusChanged || positionChanged) {
      persistRef.current(currentSession.id, nativePosition);
    }
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;

    // Some Android activities can remain simultaneously resumed. In that
    // state AppState never leaves `active`, even though another media app has
    // taken audio focus and paused the native player without a JS callback.
    const timer = setInterval(syncNativePlayback, NATIVE_STATUS_SYNC_MS);
    return () => clearInterval(timer);
  }, [status, syncNativePlayback]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        syncNativePlayback(true);
        return;
      }
      const currentSession = sessionRef.current;
      if (!currentSession || statusRef.current === 'idle') return;
      persistRef.current(currentSession.id, positionSecRef.current);
    };

    const appSub = AppState.addEventListener('change', onAppState);
    return () => appSub.remove();
  }, [syncNativePlayback]);

  const value = useMemo(
    () => ({
      session,
      worldId,
      status,
      positionSec,
      durationSec,
      soundEnabled,
      fadeMinutes,
      fadeRemainingSec,
      open,
      toggle,
      seekTo,
      skip,
      toggleSound,
      setFadeTimer,
      close,
    }),
    [
      session,
      worldId,
      status,
      positionSec,
      durationSec,
      soundEnabled,
      fadeMinutes,
      fadeRemainingSec,
      open,
      toggle,
      seekTo,
      skip,
      toggleSound,
      setFadeTimer,
      close,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerContextValue => {
  const ctx = useContext(PlayerContext);
  if (ctx) return ctx;

  return {
    session: null,
    worldId: null,
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    soundEnabled: true,
    fadeMinutes: null,
    fadeRemainingSec: null,
    open: () => {},
    toggle: () => {},
    seekTo: () => {},
    skip: () => {},
    toggleSound: () => {},
    setFadeTimer: () => {},
    close: () => {},
  };
};

export { SEEK_STEP_SEC };
