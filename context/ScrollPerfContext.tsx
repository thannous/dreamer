import React, { createContext, type ReactNode, useContext } from 'react';

const ScrollPerfContext = createContext(false);

export function ScrollPerfProvider({
  isScrolling,
  children,
}: {
  isScrolling: boolean;
  children: ReactNode;
}) {
  return (
    <ScrollPerfContext.Provider value={isScrolling}>
      {children}
    </ScrollPerfContext.Provider>
  );
}

export function useScrollPerf(): boolean {
  return useContext(ScrollPerfContext);
}
