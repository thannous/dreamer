import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { ThemeLayout } from '@/constants/journalTheme';

type SideGutters = { left: number; right: number };

// Outside the root shell (an isolated render, a test) the screens have the whole window.
const SideGuttersContext = createContext<SideGutters>({ left: 0, right: 0 });

/**
 * Folded, the iPhone Duo shows its status bar in a column beside the page and leaves no
 * inset at the top, like a phone on its side: every header would start against the edge
 * of the glass. Screens then keep a margin above them as wide as the page's own; the root
 * shell gives them these insets, and what floats over every screen reads them too.
 */
export function getScreenInsets(insets: EdgeInsets): EdgeInsets {
  if (insets.top > 0 || (insets.left === 0 && insets.right === 0)) return insets;
  return { ...insets, top: ThemeLayout.spacing.md };
}

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
