import { useDreamJournal } from '@/hooks/useDreamJournal';
import type { DreamAnalysis } from '@/lib/types';
import React, { createContext, useContext, useMemo } from 'react';

// Data context - changes when dreams array changes
export type DreamsDataContextValue = {
  dreams: DreamAnalysis[];
  loaded: boolean;
};

// Actions context - stable references, never triggers re-renders
export type DreamsActionsContextValue = {
  addDream: (dream: DreamAnalysis) => Promise<DreamAnalysis>;
  updateDream: (dream: DreamAnalysis) => Promise<void>;
  deleteDream: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  analyzeDream: (
    dreamId: number,
    transcript: string,
    options?: { replaceExistingImage?: boolean; lang?: string }
  ) => Promise<DreamAnalysis>;
};

// Combined type for backward compatibility
export type DreamsContextValue = DreamsDataContextValue & DreamsActionsContextValue;

// Separate contexts to prevent unnecessary re-renders
const DreamsDataContext = createContext<DreamsDataContextValue | null>(null);
const DreamsActionsContext = createContext<DreamsActionsContextValue | null>(null);

export const DreamsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const journal = useDreamJournal();

  // Data context - only changes when dreams/loaded changes
  const dataValue = useMemo(
    () => ({
      dreams: journal.dreams,
      loaded: journal.loaded,
    }),
    [journal.dreams, journal.loaded]
  );

  // Actions context - stable references, frozen with empty deps
  // These functions from useDreamJournal are stable (wrapped in useCallback with stable deps)
  const actionsValue = useMemo(
    () => ({
      addDream: journal.addDream,
      updateDream: journal.updateDream,
      deleteDream: journal.deleteDream,
      toggleFavorite: journal.toggleFavorite,
      analyzeDream: journal.analyzeDream,
    }),
    // Empty deps - functions from useDreamJournal are stable
    // If they change, it will be due to hook remounting which recreates provider anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <DreamsDataContext.Provider value={dataValue}>
      <DreamsActionsContext.Provider value={actionsValue}>
        {children}
      </DreamsActionsContext.Provider>
    </DreamsDataContext.Provider>
  );
};

/**
 * Hook to access dreams data (dreams array, loaded state)
 * Components using this will re-render when dreams change
 */
export const useDreamsData = (): DreamsDataContextValue => {
  const ctx = useContext(DreamsDataContext);
  if (!ctx) {
    throw new Error('useDreamsData must be used within DreamsProvider');
  }
  return ctx;
};

/**
 * Hook to access dream mutation actions
 * Components using ONLY this hook will NOT re-render when dreams data changes
 * Prefer this hook for components that only need to perform actions (e.g., buttons)
 */
export const useDreamsActions = (): DreamsActionsContextValue => {
  const ctx = useContext(DreamsActionsContext);
  if (!ctx) {
    throw new Error('useDreamsActions must be used within DreamsProvider');
  }
  return ctx;
};

/**
 * Combined hook for backward compatibility
 * Returns both data and actions - use useDreamsData or useDreamsActions for better performance
 */
export const useDreams = (): DreamsContextValue => {
  const data = useDreamsData();
  const actions = useDreamsActions();
  return { ...data, ...actions };
};
