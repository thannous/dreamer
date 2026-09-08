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
import { createLibraryPersistence } from '@/services/libraryPersistence';

type LibraryContextValue = {
  favorites: SessionId[];
  progress: LibraryState['progress'];
  practiceLog: PracticeEntry[];
  loaded: boolean;
  persistenceError: Error | null;
  retryPersistence: () => Promise<void>;
  isFavorite: (id: SessionId) => boolean;
  toggleFavorite: (id: SessionId) => Promise<void>;
  /** Records where a session was left. */
  recordProgress: (id: SessionId, positionSec: number, completed?: boolean) => Promise<void>;
  /** Appends a completed practice — a session or a breathing exercise. */
  recordPractice: (entry: Omit<PracticeEntry, 'dateISO'>, dateISO?: string) => Promise<void>;
};

type LibraryCommands = Pick<LibraryContextValue, 'recordProgress' | 'recordPractice' | 'toggleFavorite' | 'retryPersistence'>;
type LibraryMetadata = Omit<LibraryContextValue, 'progress'>;
const LibraryMetadataContext = createContext<LibraryMetadata | null>(null);
const LibraryProgressContext = createContext<LibraryState['progress']>({});
const LibraryCommandsContext = createContext<LibraryCommands | null>(null);

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<LibraryState>(INITIAL_LIBRARY);
  const [loaded, setLoaded] = useState(false);

  const [persistenceError, setPersistenceError] = useState<Error | null>(null);
  const [persistence] = useState(createLibraryPersistence);
  const stateRef = useRef(state);
  const hydratedRef = useRef(false);
  const mountedRef = useRef(true);
  const save = useCallback(async (next: LibraryState) => {
    try {
      await persistence.save(next);
      if (mountedRef.current) setPersistenceError(null);
    } catch (error) {
      if (mountedRef.current) setPersistenceError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [persistence]);

  const commit = useCallback(async (next: LibraryState) => {
    // An unread library must never be replaced by the initial empty UI state.
    if (!hydratedRef.current) return;
    stateRef.current = next;
    if (mountedRef.current) setState(next);
    await save(next);
  }, [save]);

  const retryPersistence = useCallback(async () => {
    if (hydratedRef.current) {
      await save(stateRef.current);
      return;
    }
    try {
      const stored = await persistence.load();
      if (!mountedRef.current) return;
      stateRef.current = stored;
      hydratedRef.current = true;
      setState(stored);
      setLoaded(true);
      if (mountedRef.current) setPersistenceError(null);
    } catch (error) {
      if (mountedRef.current) setPersistenceError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [persistence, save]);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;
    persistence.load().then((stored) => {
      if (!mounted) return;
      stateRef.current = stored;
      hydratedRef.current = true;
      setState(stored);
      setLoaded(true);
      if (mountedRef.current) setPersistenceError(null);
    }).catch((error) => {
      if (mounted) setPersistenceError(error instanceof Error ? error : new Error(String(error)));
    });
    return () => { mounted = false; mountedRef.current = false; };
  }, [persistence]);

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
      if (!completed && previous?.positionSec === positionSec) {
        if (hydratedRef.current) await save(current);
        return;
      }

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
    [commit, save]
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
      persistenceError,
      retryPersistence,
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
      persistenceError,
      retryPersistence,
      isFavorite,
      toggleFavorite,
      recordProgress,
      recordPractice,
    ]
  );

  const commands = useMemo(() => ({ recordProgress, recordPractice, toggleFavorite, retryPersistence }),
    [recordProgress, recordPractice, toggleFavorite, retryPersistence]);
  const metadata = useMemo(() => ({ favorites: state.favorites, practiceLog: state.practiceLog,
    loaded, persistenceError, isFavorite, ...commands }),
    [state.favorites, state.practiceLog, loaded, persistenceError, isFavorite, commands]);
  return <LibraryCommandsContext.Provider value={commands}>
    <LibraryMetadataContext.Provider value={metadata}>
    <LibraryProgressContext.Provider value={state.progress}>
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
    </LibraryProgressContext.Provider>
    </LibraryMetadataContext.Provider>
  </LibraryCommandsContext.Provider>;
};

export const useLibrary = (): LibraryContextValue => {
  const ctx = useContext(LibraryContext);

  return (
    ctx ?? {
      favorites: [],
      progress: {},
      practiceLog: [],
      loaded: false,
      persistenceError: null,
      retryPersistence: async () => {},
      isFavorite: () => false,
      toggleFavorite: async () => {},
      recordProgress: async () => {},
      recordPractice: async () => {},
    }
  );
};

/** Stable mutation subscription for the player; progress updates do not invalidate it. */
export const useLibraryCommands = (): LibraryCommands => {
  const commands = useContext(LibraryCommandsContext);
  if (!commands) throw new Error('useLibraryCommands requires LibraryProvider');
  return commands;
};

export const useLibraryMetadata = (): LibraryMetadata => {
  const metadata = useContext(LibraryMetadataContext);
  if (!metadata) throw new Error('useLibraryMetadata requires LibraryProvider');
  return metadata;
};

export const useLibraryProgress = (): LibraryState['progress'] => useContext(LibraryProgressContext);
