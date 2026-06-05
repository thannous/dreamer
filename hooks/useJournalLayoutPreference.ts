import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { JournalLayoutPreference } from '@/lib/types';
import {
  getJournalLayoutPreference,
  saveJournalLayoutPreference,
} from '@/services/storageService';

export function useJournalLayoutPreference() {
  const [preference, setPreferenceState] = useState<JournalLayoutPreference>('cards');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadPreference() {
        try {
          const savedPreference = await getJournalLayoutPreference();
          if (mounted) {
            setPreferenceState(savedPreference);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[useJournalLayoutPreference] Failed to load preference:', error);
          }
        } finally {
          if (mounted) {
            setLoaded(true);
          }
        }
      }

      void loadPreference();

      return () => {
        mounted = false;
      };
    }, []),
  );

  const setPreference = useCallback(async (nextPreference: JournalLayoutPreference) => {
    await saveJournalLayoutPreference(nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  return {
    loaded,
    preference,
    setPreference,
  };
}
