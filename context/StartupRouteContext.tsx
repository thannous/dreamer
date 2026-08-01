import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

type StartupRouteContextValue = {
  routeCommitted: boolean;
};

// Fail open for isolated route renders and tests. The application root always
// provides the measured startup state explicitly.
const StartupRouteContext = createContext<StartupRouteContextValue>({
  routeCommitted: true,
});

export function StartupRouteProvider({
  children,
  routeCommitted,
}: {
  children: ReactNode;
  routeCommitted: boolean;
}) {
  const value = useMemo(() => ({ routeCommitted }), [routeCommitted]);

  return (
    <StartupRouteContext.Provider value={value}>
      {children}
    </StartupRouteContext.Provider>
  );
}

export function useStartupRoute(): StartupRouteContextValue {
  return useContext(StartupRouteContext);
}
