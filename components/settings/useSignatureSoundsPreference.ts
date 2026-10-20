import { useCallback, useEffect, useState } from 'react';

import { getSignatureSoundsEnabled, setSignatureSoundsEnabled } from '@/services/signatureSounds';

/** Noctalia's signature sounds, on until the dreamer turns them off. */
export function useSignatureSoundsPreference() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    void getSignatureSoundsEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback((next: boolean) => {
    setEnabled(next);
    void setSignatureSoundsEnabled(next).catch(() => setEnabled(!next));
  }, []);

  return { enabled, toggle };
}
