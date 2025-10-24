import React, { createContext, useContext } from 'react';
import { useDreamJournal } from '@/hooks/useDreamJournal';
import type { DreamAnalysis } from '@/lib/types';

type Ctx = {
  dreams: DreamAnalysis[];
  loaded: boolean;
  addDream: (d: DreamAnalysis) => Promise<void>;
  updateDream: (d: DreamAnalysis) => Promise<void>;
  deleteDream: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
};

const DreamsContext = createContext<Ctx | null>(null);

export const DreamsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const journal = useDreamJournal();
  return <DreamsContext.Provider value={journal as unknown as Ctx}>{children}</DreamsContext.Provider>;
};

export const useDreams = () => {
  const ctx = useContext(DreamsContext);
  if (!ctx) throw new Error('useDreams must be used within DreamsProvider');
  return ctx;
};

