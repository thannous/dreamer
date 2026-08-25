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

import { SESSION_BY_ID } from '@/content/sessions';
import {
  WORLD_SOUND_BY_ID,
  WORLD_SOUND_TRACK_DURATION_SEC,
} from '@/content/worldSounds';
import { DEFAULT_WORLD_ID, type WorldId } from '@/constants/worlds';
import { useLibrary } from '@/context/LibraryContext';
import {
  clampSeek,
  effectiveDuration,
  fadeVolume,
  isPractised,
  seekBy as seekByPure,
  SEEK_STEP_SEC,
  type FadeTimerMinutes,
} from '@/lib/audio';
import type { MeditationSession, SessionId } from '@/lib/types';
import * as audio from '@/services/audioService';

/** How often the listening position is written to storage. */
const PERSIST_EVERY_SEC = 5;

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
  const completedRef = useRef(false);

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

  const open = useCallback(
    (sessionId: SessionId, startAtSec = 0, openedWorldId?: WorldId) => {
      const next = SESSION_BY_ID[sessionId];
      if (!next) return;

      teardown();
      completedRef.current = false;
      lastPersistedRef.current = 0;
      setSession(next);
      const resolvedWorldId = openedWorldId ?? DEFAULT_WORLD_ID;
      const sound = WORLD_SOUND_BY_ID[resolvedWorldId];

      setWorldId(resolvedWorldId);
      setPositionSec(startAtSec);
      setLoadedDuration(0);
      setFadeMinutes(null);
      setFadeRemaining(null);
      setStatus('loading');

      const player = audio.createSessionPlayer(
        sound.primary.source,
        next.durationSec,
        WORLD_SOUND_TRACK_DURATION_SEC
      );
      primaryVolumeRef.current = sound.primary.volume;
      audio.setVolume(player, soundEnabled ? sound.primary.volume : 0);
      playerRef.current = player;

      if (sound.secondary) {
        const texture = audio.createPlayer(sound.secondary.source, 1_000);
        audio.setLoop(texture, true);
        audio.setRate(texture, sound.secondary.rate);
        audio.setVolume(texture, sound.secondary.volume);
        textureVolumeRef.current = sound.secondary.volume;
        textureRef.current = texture;
      }

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (statusUpdate) => {
        setLoadedDuration(statusUpdate.duration);
        setPositionSec(statusUpdate.currentTime);
        setStatus(statusUpdate.playing ? 'playing' : 'paused');

        if (statusUpdate.currentTime - lastPersistedRef.current >= PERSIST_EVERY_SEC) {
          lastPersistedRef.current = statusUpdate.currentTime;
          persist(next.id, statusUpdate.currentTime);
        }

        const total = effectiveDuration(statusUpdate.duration, next.durationSec);
        if (!completedRef.current && isPractised(statusUpdate.currentTime, total)) {
          completedRef.current = true;
          persist(next.id, statusUpdate.currentTime, true);
          // Same log a breathing exercise writes to: L5 counts both alike.
          recordPractice({
            sessionId: next.id,
            seconds: Math.round(statusUpdate.currentTime),
          }).catch(() => {});
        }

        if (statusUpdate.didJustFinish) {
          const worldParam = `&worldId=${resolvedWorldId}`;
          router.replace(`/session-complete?id=${next.id}${worldParam}`);
        }
      });

      if (startAtSec > 0) audio.seekTo(player, startAtSec).catch(() => {});
      audio.play(player);
      if (soundEnabled && textureRef.current) audio.play(textureRef.current);
    },
    [persist, recordPractice, router, soundEnabled, teardown]
  );

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (status === 'playing') {
      audio.pause(player);
      if (session) persist(session.id, positionSec);
      if (textureRef.current) audio.pause(textureRef.current);
    } else {
      audio.play(player);
      if (soundEnabled && textureRef.current) audio.play(textureRef.current);
    }
  }, [persist, positionSec, session, soundEnabled, status]);

  const seekTo = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      const target = clampSeek(seconds, durationSec);
      setPositionSec(target);
      audio.seekTo(player, target).catch(() => {});
    },
    [durationSec]
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
          return null;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [fadeRemainingSec === null, soundEnabled, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    if (session && positionSec > 0) persist(session.id, positionSec);
    teardown();
    setSession(null);
    setWorldId(null);
    setStatus('idle');
    setPositionSec(0);
    setFadeMinutes(null);
    setFadeRemaining(null);
  }, [persist, positionSec, session, teardown]);

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
