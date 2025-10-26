import React, { createContext, useContext, useMemo } from 'react';
import { useDreamJournal } from '@/hooks/useDreamJournal';
import type { DreamAnalysis } from '@/lib/types';

export type DreamsContextValue = {
  dreams: DreamAnalysis[];
  loaded: boolean;
  addDream: (dream: DreamAnalysis) => Promise<void>;
  updateDream: (dream: DreamAnalysis) => Promise<void>;
  deleteDream: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
};

const DreamsContext = createContext<DreamsContextValue | null>(null);

export const DreamsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const journal = useDreamJournal();

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    dreams: journal.dreams,
    loaded: journal.loaded,
    addDream: journal.addDream,
    updateDream: journal.updateDream,
    deleteDream: journal.deleteDream,
    toggleFavorite: journal.toggleFavorite,
  }), [journal.dreams, journal.loaded, journal.addDream, journal.updateDream, journal.deleteDream, journal.toggleFavorite]);

  return <DreamsContext.Provider value={value}>{children}</DreamsContext.Provider>;
};

export const useDreams = (): DreamsContextValue => {
  const ctx = useContext(DreamsContext);
  if (!ctx) {
    throw new Error('useDreams must be used within DreamsProvider');
  }
  return ctx;
};

