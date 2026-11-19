import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { trackProductEvent } from '@/lib/analytics';
import type { JournalLayoutPreference } from '@/lib/types';
import {
  getJournalLayoutPreference,
  saveJournalLayoutPreference,
} from '@/services/storageService';

// The quick-settings drawer opens over the journal without blurring it, so a choice made
// there has to reach the journal's own instance of this hook: every mounted instance shares
// the last known value and hears each saved change. A later mount starts from that value
// instead of flashing the default layout.
let knownPreference: JournalLayoutPreference | null = null;
const listeners = new Set<(preference: JournalLayoutPreference) => void>();

function publish(preference: JournalLayoutPreference) {
  knownPreference = preference;
  listeners.forEach((listener) => listener(preference));
}

export function useJournalLayoutPreference() {
  const [preference, setPreferenceState] = useState<JournalLayoutPreference>(() => knownPreference ?? 'cards');
  const [loaded, setLoaded] = useState(() => knownPreference !== null);

  useEffect(() => {
    const listener = (next: JournalLayoutPreference) => {
      setPreferenceState(next);
      setLoaded(true);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadPreference() {
        try {
          const savedPreference = await getJournalLayoutPreference();
          if (mounted) {
            knownPreference = savedPreference;
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
    const previousPreference = knownPreference ?? preference;
    await saveJournalLayoutPreference(nextPreference);
    publish(nextPreference);
    if (previousPreference === nextPreference) {
      return;
    }
    void trackProductEvent('journal_layout_preference_changed', {
      from: previousPreference,
      to: nextPreference,
      source: 'settings',
    });
  }, [preference]);

  return {
    loaded,
    preference,
    setPreference,
  };
}

/** Test seam: forget the shared value between isolated renders. */
export function resetJournalLayoutPreferenceForTests() {
  knownPreference = null;
  listeners.clear();
}
