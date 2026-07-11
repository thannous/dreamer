import { useEffect, useState } from 'react';

export const SPLASH_FAILSAFE_TIMEOUT_MS = 8_000;

export function useSplashFailsafe(
  active: boolean,
  timeoutMs = SPLASH_FAILSAFE_TIMEOUT_MS
) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active || timedOut) {
      return;
    }

    const timeout = setTimeout(() => setTimedOut(true), timeoutMs);

    return () => clearTimeout(timeout);
  }, [active, timedOut, timeoutMs]);

  return timedOut;
}
