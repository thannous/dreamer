import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';

type SideGutters = { left: number; right: number };

// Outside the root shell (an isolated render, a test) the screens have the whole window.
const SideGuttersContext = createContext<SideGutters>({ left: 0, right: 0 });

/** Set by the root shell, which keeps every screen clear of the side safe areas. */
export function SideGuttersProvider({ left, right, children }: SideGutters & { children: ReactNode }) {
  const value = useMemo(() => ({ left, right }), [left, right]);
  return <SideGuttersContext.Provider value={value}>{children}</SideGuttersContext.Provider>;
}

/** The side safe areas the root shell keeps clear, to place a window-measured point inside a screen. */
export function useSideGutters(): SideGutters {
  return useContext(SideGuttersContext);
}

/**
 * The window the screens lay out in, shaped like `useWindowDimensions`: the window less
 * the side safe areas the root shell keeps clear, such as the status bar column of the
 * iPhone Duo or a phone's camera on its side. A React Native `Modal` covers the whole
 * window, so what it shows keeps `useWindowDimensions`.
 */
export function useContentWindow(): ScaledSize {
  const window = useWindowDimensions();
  const { left, right } = useContext(SideGuttersContext);
  const width = Math.max(0, window.width - left - right);
  return useMemo(
    () => ({ width, height: window.height, scale: window.scale, fontScale: window.fontScale }),
    [width, window.height, window.scale, window.fontScale],
  );
}
