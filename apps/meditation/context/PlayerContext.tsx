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

import { AMBIENCE_BY_ID, type AmbienceId } from '@/content/ambiences';
import { SESSION_BY_ID } from '@/content/sessions';
import { useLibrary } from '@/context/LibraryContext';
import {
  clampSeek,
  effectiveDuration,
  fadeVolume,
  isPractised,
  seekBy as seekByPure,
  SEEK_STEP_SEC,
  type FadeTimerMinutes,
  type PlaybackRate,
} from '@/lib/audio';
import type { MeditationSession, SessionId } from '@/lib/types';
import * as audio from '@/services/audioService';
import { resolveSessionAudio, type ResolvedAudio } from '@/services/mediaService';

/** How often the listening position is written to storage. */
const PERSIST_EVERY_SEC = 5;

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

type PlayerContextValue = {
  session: MeditationSession | null;
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  rate: PlaybackRate;
  ambienceId: AmbienceId;
  fadeMinutes: FadeTimerMinutes | null;
  /** Seconds left on the fade timer, or null when none is running. */
  fadeRemainingSec: number | null;
  open: (sessionId: SessionId, startAtSec?: number) => void;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  skip: (deltaSec: number) => void;
  setRate: (rate: PlaybackRate) => void;
  setAmbience: (id: AmbienceId) => void;
  setFadeTimer: (minutes: FadeTimerMinutes | null) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const { recordProgress, recordPractice } = useLibrary();

  const [session, setSession] = useState<MeditationSession | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [positionSec, setPositionSec] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(0);
  const [rate, setRateState] = useState<PlaybackRate>(1);
  const [ambienceId, setAmbienceState] = useState<AmbienceId>('none');
  const [fadeMinutes, setFadeMinutes] = useState<FadeTimerMinutes | null>(null);
  const [fadeRemainingSec, setFadeRemaining] = useState<number | null>(null);

  const playerRef = useRef<audio.PlayerHandle | null>(null);
  const ambienceRef = useRef<audio.PlayerHandle | null>(null);
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
    if (ambienceRef.current) {
      audio.release(ambienceRef.current);
      ambienceRef.current = null;
    }
  }, []);

  useEffect(() => teardown, [teardown]);

  const durationSec = effectiveDuration(loadedDuration, session?.durationSec ?? 0);

  const persist = useCallback(
    (positionValue: number, completed = false) => {
      if (!session) return;
      recordProgress(session.id, Math.round(positionValue), completed).catch(() => {});
    },
    [recordProgress, session]
  );

  const open = useCallback(
    (sessionId: SessionId, startAtSec = 0) => {
      const next = SESSION_BY_ID[sessionId];
      if (!next) return;

      teardown();
      completedRef.current = false;
      lastPersistedRef.current = 0;
      setSession(next);
      setPositionSec(startAtSec);
      setLoadedDuration(0);
      setFadeMinutes(null);
      setFadeRemaining(null);
      setStatus('loading');

      const resolved: ResolvedAudio = resolveSessionAudio(sessionId);
      if (resolved.kind === 'unavailable') {
        // Honest dead end rather than a spinner that never resolves: no bucket
        // configured, or nothing cached and no network.
        setStatus('unavailable');
        return;
      }

      const player = audio.createPlayer(resolved.source);
      playerRef.current = player;

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (statusUpdate) => {
        setLoadedDuration(statusUpdate.duration);
        setPositionSec(statusUpdate.currentTime);
        setStatus(statusUpdate.playing ? 'playing' : 'paused');

        if (statusUpdate.currentTime - lastPersistedRef.current >= PERSIST_EVERY_SEC) {
          lastPersistedRef.current = statusUpdate.currentTime;
          persist(statusUpdate.currentTime);
        }

        const total = effectiveDuration(statusUpdate.duration, next.durationSec);
        if (!completedRef.current && isPractised(statusUpdate.currentTime, total)) {
          completedRef.current = true;
          persist(statusUpdate.currentTime, true);
          // Same log a breathing exercise writes to: L5 counts both alike.
          recordPractice({
            sessionId: next.id,
            seconds: Math.round(statusUpdate.currentTime),
          }).catch(() => {});
        }

        if (statusUpdate.didJustFinish) {
          router.replace(`/session-complete?id=${next.id}`);
        }
      });

      if (startAtSec > 0) audio.seekTo(player, startAtSec).catch(() => {});
      audio.play(player);
    },
    [persist, recordPractice, router, teardown]
  );

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (status === 'playing') {
      audio.pause(player);
      persist(positionSec);
      if (ambienceRef.current) audio.pause(ambienceRef.current);
    } else {
      audio.play(player);
      if (ambienceRef.current) audio.play(ambienceRef.current);
    }
  }, [status, positionSec, persist]);

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

  const setRate = useCallback((next: PlaybackRate) => {
    setRateState(next);
    if (playerRef.current) audio.setRate(playerRef.current, next);
  }, []);

  const setAmbience = useCallback(
    (id: AmbienceId) => {
      setAmbienceState(id);

      if (ambienceRef.current) {
        audio.release(ambienceRef.current);
        ambienceRef.current = null;
      }

      const source = AMBIENCE_BY_ID[id]?.source;
      if (!source) return;

      const loop = audio.createPlayer(source);
      audio.setLoop(loop, true);
      // Deliberately quiet: a bed under a voice, never next to it.
      audio.setVolume(loop, 0.35);
      ambienceRef.current = loop;
      if (status === 'playing') audio.play(loop);
    },
    [status]
  );

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
        if (player) audio.setVolume(player, fadeVolume(next));
        if (ambienceRef.current) audio.setVolume(ambienceRef.current, fadeVolume(next, 0.35));

        if (next <= 0) {
          if (player) audio.pause(player);
          if (ambienceRef.current) audio.pause(ambienceRef.current);
          return null;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [fadeRemainingSec === null, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    if (positionSec > 0) persist(positionSec);
    teardown();
    setSession(null);
    setStatus('idle');
    setPositionSec(0);
    setFadeMinutes(null);
    setFadeRemaining(null);
  }, [persist, positionSec, teardown]);

  const value = useMemo(
    () => ({
      session,
      status,
      positionSec,
      durationSec,
      rate,
      ambienceId,
      fadeMinutes,
      fadeRemainingSec,
      open,
      toggle,
      seekTo,
      skip,
      setRate,
      setAmbience,
      setFadeTimer,
      close,
    }),
    [
      session,
      status,
      positionSec,
      durationSec,
      rate,
      ambienceId,
      fadeMinutes,
      fadeRemainingSec,
      open,
      toggle,
      seekTo,
      skip,
      setRate,
      setAmbience,
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
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    rate: 1,
    ambienceId: 'none',
    fadeMinutes: null,
    fadeRemainingSec: null,
    open: () => {},
    toggle: () => {},
    seekTo: () => {},
    skip: () => {},
    setRate: () => {},
    setAmbience: () => {},
    setFadeTimer: () => {},
    close: () => {},
  };
};

export { SEEK_STEP_SEC };
