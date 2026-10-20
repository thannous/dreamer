import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getSignatureSoundsEnabled,
  peekSignatureSoundsEnabled,
  setSignatureSoundsEnabled,
} from '@/services/signatureSounds';

/** Noctalia's signature sounds, on until the dreamer turns them off. */
export function useSignatureSoundsPreference() {
  // Read once a launch: a second visit to the settings shows the choice from the start.
  const [enabled, setEnabled] = useState(() => peekSignatureSoundsEnabled() ?? true);
  // A switch flipped before the stored choice is read keeps the dreamer's word.
  const touched = useRef(false);
  const toggles = useRef(0);

  useEffect(() => {
    let active = true;
    void getSignatureSoundsEnabled().then((value) => {
      if (active && !touched.current) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback((next: boolean) => {
    touched.current = true;
    const toggled = ++toggles.current;
    setEnabled(next);
    // Not stored: the switch shows what storage still holds, once the last flip has failed.
    void setSignatureSoundsEnabled(next).catch(async () => {
      const kept = await getSignatureSoundsEnabled();
      if (toggled === toggles.current) setEnabled(kept);
    });
  }, []);

  return { enabled, toggle };
}
