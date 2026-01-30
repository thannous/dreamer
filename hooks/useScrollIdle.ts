import { useCallback, useEffect, useRef, useState } from 'react';

type ScrollIdleHandlers = {
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
};

export function useScrollIdle(idleMs = 140): { isScrolling: boolean } & ScrollIdleHandlers {
  const [isScrolling, setIsScrolling] = useState(false);
  const isScrollingRef = useRef(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setScrolling = useCallback((next: boolean) => {
    if (isScrollingRef.current === next) return;
    isScrollingRef.current = next;
    setIsScrolling(next);
  }, []);

  const handleScrollBegin = useCallback(() => {
    setScrolling(true);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, [setScrolling]);

  const handleScrollEnd = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(() => {
      setScrolling(false);
    }, idleMs);
  }, [idleMs, setScrolling]);

  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, []);

  return {
    isScrolling,
    onScrollBeginDrag: handleScrollBegin,
    onScrollEndDrag: handleScrollEnd,
    onMomentumScrollBegin: handleScrollBegin,
    onMomentumScrollEnd: handleScrollEnd,
  };
}
