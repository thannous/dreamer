import React, { createContext, useCallback, useContext, type ReactNode } from 'react';

const Decorative = createContext(false);

/**
 * A drawn copy of a page, such as the page being turned to: hidden from assistive
 * technologies by its container, and without the test ids of the live page it mirrors,
 * so a test never finds a component twice.
 */
export function DecorativeCopy({ children }: { children: ReactNode }) {
  return <Decorative.Provider value>{children}</Decorative.Provider>;
}

/** Decorative copies must not emit effects that describe a live display. */
export function useIsDecorativeCopy(): boolean {
  return useContext(Decorative);
}

/** Test ids as the live page sets them, withheld inside a decorative copy. */
export function useLiveTestID(): (id: string | undefined) => string | undefined {
  const decorative = useContext(Decorative);
  return useCallback((id) => (decorative ? undefined : id), [decorative]);
}
