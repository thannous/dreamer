import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  INITIAL_LIBRARY,
  PRACTICE_LOG_MAX,
  type LibraryState,
  type PracticeEntry,
  type SessionId,
} from '@/lib/types';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

type LibraryContextValue = {
  favorites: SessionId[];
  progress: LibraryState['progress'];
  practiceLog: PracticeEntry[];
  loaded: boolean;
  isFavorite: (id: SessionId) => boolean;
  toggleFavorite: (id: SessionId) => Promise<void>;
  /** Records where a session was left. */
  recordProgress: (id: SessionId, positionSec: number, completed?: boolean) => Promise<void>;
  /** Appends a completed practice — a session or a breathing exercise. */
  recordPractice: (entry: Omit<PracticeEntry, 'dateISO'>, dateISO?: string) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<LibraryState>(INITIAL_LIBRARY);
  const [loaded, setLoaded] = useState(false);

  // Same synchronous mirror as OnboardingContext: two taps in one tick must
  // both land. Favourites are toggled fast, in lists.
  const stateRef = useRef(state);

  const commit = useCallback(async (next: LibraryState) => {
    stateRef.current = next;
    setState(next);
    await writeJson(StorageKey.favorites, next);
  }, []);

  useEffect(() => {
    let mounted = true;

    readJson<LibraryState>(StorageKey.favorites, INITIAL_LIBRARY)
      .then((stored) => {
        if (!mounted) return;
        const merged = { ...INITIAL_LIBRARY, ...stored };
        stateRef.current = merged;
        setState(merged);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isFavorite = useCallback(
    (id: SessionId) => state.favorites.includes(id),
    [state.favorites]
  );

  const toggleFavorite = useCallback(
    async (id: SessionId) => {
      const current = stateRef.current;
      const favorites = current.favorites.includes(id)
        ? current.favorites.filter((item) => item !== id)
        : [...current.favorites, id];
      await commit({ ...current, favorites });
    },
    [commit]
  );

  const recordProgress = useCallback(
    async (id: SessionId, positionSec: number, completed = false) => {
      const current = stateRef.current;
      const previous = current.progress[id];

      await commit({
        ...current,
        progress: {
          ...current.progress,
          [id]: {
            positionSec,
            completedCount: (previous?.completedCount ?? 0) + (completed ? 1 : 0),
            lastPlayedISO: new Date().toISOString(),
          },
        },
      });
    },
    [commit]
  );

  const recordPractice = useCallback(
    async (entry: Omit<PracticeEntry, 'dateISO'>, dateISO?: string) => {
      const current = stateRef.current;
      // Local calendar day, not UTC: a 23:40 practice belongs to that evening.
      const day = dateISO ?? new Date().toLocaleDateString('sv-SE');
      const next = [...current.practiceLog, { ...entry, dateISO: day }];

      await commit({
        ...current,
        practiceLog: next.slice(-PRACTICE_LOG_MAX),
      });
    },
    [commit]
  );

  const value = useMemo(
    () => ({
      favorites: state.favorites,
      progress: state.progress,
      practiceLog: state.practiceLog,
      loaded,
      isFavorite,
      toggleFavorite,
      recordProgress,
      recordPractice,
    }),
    [
      state.favorites,
      state.progress,
      state.practiceLog,
      loaded,
      isFavorite,
      toggleFavorite,
      recordProgress,
      recordPractice,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = (): LibraryContextValue => {
  const ctx = useContext(LibraryContext);

  return (
    ctx ?? {
      favorites: [],
      progress: {},
      practiceLog: [],
      loaded: false,
      isFavorite: () => false,
      toggleFavorite: async () => {},
      recordProgress: async () => {},
      recordPractice: async () => {},
    }
  );
};
