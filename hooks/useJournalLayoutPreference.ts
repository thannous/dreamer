import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { trackProductEvent } from '@/lib/analytics';
import type { JournalLayoutPreference } from '@/lib/types';
import {
  getJournalLayoutPreference,
  saveJournalLayoutPreference,
} from '@/services/storageService';

export function useJournalLayoutPreference() {
  const [preference, setPreferenceState] = useState<JournalLayoutPreference>('cards');
  const [loaded, setLoaded] = useState(false);
  const preferenceRef = useRef<JournalLayoutPreference>('cards');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadPreference() {
        try {
          const savedPreference = await getJournalLayoutPreference();
          if (mounted) {
            preferenceRef.current = savedPreference;
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
    const previousPreference = preferenceRef.current;
    await saveJournalLayoutPreference(nextPreference);
    preferenceRef.current = nextPreference;
    setPreferenceState(nextPreference);
    if (previousPreference === nextPreference) {
      return;
    }
    void trackProductEvent('journal_layout_preference_changed', {
      from: previousPreference,
      to: nextPreference,
    });
  }, []);

  return {
    loaded,
    preference,
    setPreference,
  };
}
