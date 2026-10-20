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
    setEnabled(next);
    void setSignatureSoundsEnabled(next).catch(() => setEnabled(!next));
  }, []);

  return { enabled, toggle };
}
