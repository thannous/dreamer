import { useCallback, useEffect, useRef, useState } from 'react';

import { createScrollActivity, type ScrollActivity } from '@/context/ScrollPerfContext';

type ScrollIdleHandlers = {
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
};

/**
 * Tracks a scroller's drags and momentum. Pass `activity` to `ScrollPerfProvider`; the
 * screen calling this hook does not render again when scrolling starts or stops.
 */
export function useScrollIdle(idleMs = 140): { activity: ScrollActivity } & ScrollIdleHandlers {
  const [activity] = useState(createScrollActivity);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollBegin = useCallback(() => {
    activity.set(true);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, [activity]);

  const handleScrollEnd = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(() => {
      activity.set(false);
    }, idleMs);
  }, [activity, idleMs]);

  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, []);

  return {
    activity,
    onScrollBeginDrag: handleScrollBegin,
    onScrollEndDrag: handleScrollEnd,
    onMomentumScrollBegin: handleScrollBegin,
    onMomentumScrollEnd: handleScrollEnd,
  };
}
