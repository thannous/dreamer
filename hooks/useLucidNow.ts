import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const LUCID_NOW_REFRESH_INTERVAL_MS = 60_000;

/**
 * A low-frequency clock for Lucid Trainer date windows and calendars.
 * Native timers may pause in the background, so foregrounding also refreshes
 * the value immediately.
 */
export function useLucidNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = setInterval(refresh, LUCID_NOW_REFRESH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return now;
}
