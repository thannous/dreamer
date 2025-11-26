import { useDreamJournal } from '@/hooks/useDreamJournal';
import type { DreamAnalysis } from '@/lib/types';
import React, { createContext, useContext, useMemo } from 'react';

export type DreamsContextValue = {
  dreams: DreamAnalysis[];
  loaded: boolean;
  addDream: (dream: DreamAnalysis) => Promise<DreamAnalysis>;
  updateDream: (dream: DreamAnalysis) => Promise<void>;
  deleteDream: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  analyzeDream: (
    dreamId: number,
    transcript: string,
    options?: { replaceExistingImage?: boolean }
  ) => Promise<DreamAnalysis>;
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
    analyzeDream: journal.analyzeDream,
  }), [
    journal.dreams,
    journal.loaded,
    journal.addDream,
    journal.updateDream,
    journal.deleteDream,
    journal.toggleFavorite,
    journal.analyzeDream,
  ]);

  return <DreamsContext.Provider value={value}>{children}</DreamsContext.Provider>;
};

export const useDreams = (): DreamsContextValue => {
  const ctx = useContext(DreamsContext);
  if (!ctx) {
    throw new Error('useDreams must be used within DreamsProvider');
  }
  return ctx;
};
