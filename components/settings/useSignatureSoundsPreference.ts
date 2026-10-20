import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  getSignatureSoundsEnabled,
  peekSignatureSoundsEnabled,
  setSignatureSoundsEnabled,
  subscribeSignatureSounds,
} from '@/services/signatureSounds';

const shown = () => peekSignatureSoundsEnabled() ?? true;

/** Noctalia's signature sounds, on until the dreamer turns them off. */
export function useSignatureSoundsPreference() {
  // The choice the cues follow, on every screen that shows it: a flip that cannot be stored
  // goes back to what storage holds, even on a settings screen reopened meanwhile.
  const enabled = useSyncExternalStore(subscribeSignatureSounds, shown);

  useEffect(() => {
    void getSignatureSoundsEnabled();
  }, []);

  const toggle = useCallback((next: boolean) => {
    void setSignatureSoundsEnabled(next).catch(() => {});
  }, []);

  return { enabled, toggle };
}
