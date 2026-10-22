import { useEffect, useRef } from 'react';

import { useOnScreen } from '@/components/ui/headerStretch';

/** Long enough to read the opening of a page; a page flipped past does not count. */
export const BADGE_READING_DWELL_MS = 2000;

/**
 * Calls `onRead` once a page has stayed in view for a moment, once per `key`.
 * A null key means there is nothing to read yet (a missing dream, an unknown entry).
 */
export function useBadgeReading(key: string | null, onRead: () => void): void {
  const focused = useOnScreen();
  const onReadRef = useRef(onRead);
  const readKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    if (!focused || key === null || readKeyRef.current === key) return undefined;
    const timer = setTimeout(() => {
      readKeyRef.current = key;
      onReadRef.current();
    }, BADGE_READING_DWELL_MS);
    return () => clearTimeout(timer);
  }, [focused, key]);
}
