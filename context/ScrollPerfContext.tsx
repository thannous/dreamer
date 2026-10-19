import React, { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';

/**
 * Whether a screen is being scrolled, kept outside React state: the screen does not
 * render again when a drag starts or ends, only the components that read it do.
 */
export type ScrollActivity = {
  subscribe: (listener: () => void) => () => void;
  isScrolling: () => boolean;
  set: (next: boolean) => void;
};

export function createScrollActivity(): ScrollActivity {
  let scrolling = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isScrolling: () => scrolling,
    set(next) {
      if (scrolling === next) return;
      scrolling = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const RESTING: ScrollActivity = createScrollActivity();

const ScrollPerfContext = createContext<ScrollActivity>(RESTING);

export function ScrollPerfProvider({
  activity,
  children,
}: {
  activity?: ScrollActivity;
  children: ReactNode;
}) {
  return (
    <ScrollPerfContext.Provider value={activity ?? RESTING}>
      {children}
    </ScrollPerfContext.Provider>
  );
}

export function useScrollPerf(): boolean {
  const activity = useContext(ScrollPerfContext);
  return useSyncExternalStore(activity.subscribe, activity.isScrolling, activity.isScrolling);
}
