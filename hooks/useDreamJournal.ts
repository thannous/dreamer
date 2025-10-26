import { useEffect, useState, useCallback, useRef } from 'react';
import type { DreamAnalysis } from '@/lib/types';
import { getSavedDreams, saveDreams } from '@/services/storageService';

export const useDreamJournal = () => {
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dreamsRef = useRef<DreamAnalysis[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    dreamsRef.current = dreams;
  }, [dreams]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const d = await getSavedDreams();
      if (mounted) {
        setDreams(d);
        setLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const updateAndSaveDreams = useCallback(async (newDreams: DreamAnalysis[]) => {
    const sorted = [...newDreams].sort((a, b) => b.id - a.id);
    setDreams(sorted);
    await saveDreams(sorted);
  }, []);

  const addDream = useCallback(
    async (dream: DreamAnalysis) => {
      const currentDreams = dreamsRef.current;
      await updateAndSaveDreams([dream, ...currentDreams]);
    },
    [updateAndSaveDreams]
  );

  const updateDream = useCallback(
    async (updatedDream: DreamAnalysis) => {
      const currentDreams = dreamsRef.current;
      const newDreams = currentDreams.map((d) => (d.id === updatedDream.id ? updatedDream : d));
      await updateAndSaveDreams(newDreams);
    },
    [updateAndSaveDreams]
  );

  const deleteDream = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const newDreams = currentDreams.filter((d) => d.id !== dreamId);
      await updateAndSaveDreams(newDreams);
    },
    [updateAndSaveDreams]
  );

  const toggleFavorite = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const newDreams = currentDreams.map((d) => (d.id === dreamId ? { ...d, isFavorite: !d.isFavorite } : d));
      await updateAndSaveDreams(newDreams);
    },
    [updateAndSaveDreams]
  );

  return { dreams, loaded, addDream, updateDream, deleteDream, toggleFavorite };
};

