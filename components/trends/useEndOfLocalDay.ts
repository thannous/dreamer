import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const endOfLocalDay = (time = Date.now()): number => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
};

/**
 * The last moment of today on this device. It moves on at midnight and when the app
 * comes back to the foreground, so a page left open overnight, or resumed the next
 * morning, reads on the new day.
 */
export function useEndOfLocalDay(): number {
  const [end, setEnd] = useState(() => endOfLocalDay());

  useEffect(() => {
    const refresh = () => setEnd(endOfLocalDay());
    // A second past midnight, since a timer can fire a little early.
    const timer = setTimeout(refresh, Math.max(0, end - Date.now()) + 1_001);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [end]);

  return end;
}
