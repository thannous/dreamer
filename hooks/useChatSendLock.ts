import { useCallback, useRef, useState } from 'react';

import type { DreamChatCategory } from '@/lib/types';

export function useChatSendLock() {
  const lockRef = useRef<DreamChatCategory | null>(null);
  const [activeCategory, setActiveCategory] = useState<DreamChatCategory | null>(null);

  const tryAcquire = useCallback((category: DreamChatCategory = 'general'): boolean => {
    if (lockRef.current !== null) {
      return false;
    }

    lockRef.current = category;
    setActiveCategory(category);
    return true;
  }, []);

  const release = useCallback(() => {
    lockRef.current = null;
    setActiveCategory(null);
  }, []);

  return {
    activeCategory,
    isLocked: activeCategory !== null,
    tryAcquire,
    release,
  };
}
