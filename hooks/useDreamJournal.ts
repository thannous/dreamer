import { useEffect, useState, useCallback } from 'react';
import type { DreamAnalysis } from '@/lib/types';
import { getSavedDreams, saveDreams } from '@/services/storageService';

export const useDreamJournal = () => {
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await getSavedDreams();
      setDreams(d);
      setLoaded(true);
    })();
  }, []);

  const updateAndSaveDreams = useCallback(async (newDreams: DreamAnalysis[]) => {
    const sorted = [...newDreams].sort((a, b) => b.id - a.id);
    setDreams(sorted);
    await saveDreams(sorted);
  }, []);

  const addDream = useCallback(async (dream: DreamAnalysis) => {
    await updateAndSaveDreams([dream, ...dreams]);
  }, [dreams, updateAndSaveDreams]);

  const updateDream = useCallback(async (updatedDream: DreamAnalysis) => {
    const newDreams = dreams.map((d) => (d.id === updatedDream.id ? updatedDream : d));
    await updateAndSaveDreams(newDreams);
  }, [dreams, updateAndSaveDreams]);

  const deleteDream = useCallback(async (dreamId: number) => {
    const newDreams = dreams.filter((d) => d.id !== dreamId);
    await updateAndSaveDreams(newDreams);
  }, [dreams, updateAndSaveDreams]);

  const toggleFavorite = useCallback(async (dreamId: number) => {
    const newDreams = dreams.map((d) => (d.id === dreamId ? { ...d, isFavorite: !d.isFavorite } : d));
    await updateAndSaveDreams(newDreams);
  }, [dreams, updateAndSaveDreams]);

  return { dreams, loaded, addDream, updateDream, deleteDream, toggleFavorite };
};

