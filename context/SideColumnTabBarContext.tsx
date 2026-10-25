import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { IconSymbol } from '@/components/ui/icon-symbol';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

/** The navigation's five destinations, in reading order. */
export type NavigationKey = 'home' | 'journal' | 'addDream' | 'stats' | 'explore';

/** The column the system keeps at one side of the window for its own bars. */
export type SideColumn = { side: 'left' | 'right'; width: number };

/** A side safe area narrower than this cannot hold the navigation's labels. */
export const SIDE_COLUMN_MIN_WIDTH = 64;

/**
 * Built with the iOS 27.1 SDK, the iPhone Duo folded (upright or on its side) and open on
 * its side gathers the status bar, the camera and the system's bars into one column at
 * one side of the window: its only side safe area. Apple's apps keep their tab bar at the
 * bottom of that column, near the thumb, and ours goes there too. A phone on its side has
 * a safe area at both sides, and Android's are a navigation bar or a camera cutout, never
 * a place for the app's controls.
 */
export function getSideColumn(
  { left, right }: { left: number; right: number },
  os: string = Platform.OS,
): SideColumn | null {
  if (os === 'android' || (left > 0 && right > 0)) return null;
  const width = Math.max(left, right);
  return width >= SIDE_COLUMN_MIN_WIDTH ? { side: right > 0 ? 'right' : 'left', width } : null;
}

/** Who shows the navigation: the tab pages, or Capture, which sits above them. */
export type SideColumnTabBarOwner = 'tabs' | 'recording';

/** What a screen's navigation shows, and what its presses do. */
export type SideColumnTabBar = {
  activeKey: NavigationKey;
  /** Opens another destination. */
  onSelect: (key: NavigationKey) => void;
  captureIcon?: IconName;
  /** Pressing Capture while already on Capture; without it the press does nothing. */
  onCapturePress?: () => void;
  /** What that press does now, for screen readers. */
  capturePressHint?: string;
};

type Entry = { id: string; owner: SideColumnTabBarOwner; bar: SideColumnTabBar };
type Registry = {
  column: SideColumn | null;
  setBar: (id: string, entry: Entry | null) => void;
};

// Outside the root shell (an isolated render, a test) there is no column: screens keep their bar.
const SideColumnTabBarContext = createContext<Registry>({ column: null, setBar: () => undefined });

/**
 * The root shell keeps the screens clear of the column, so a screen cannot draw there, nor
 * be touched there: the shell draws the navigation in it, as the screens hand it over.
 */
export function useSideColumnTabBarRegistry(column: SideColumn | null) {
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const setBar = useCallback((id: string, entry: Entry | null) => {
    setEntries((current) => {
      const rest = current.filter((item) => item.id !== id);
      return entry ? [...rest, entry] : rest;
    });
  }, []);
  const value = useMemo(() => ({ column, setBar }), [column, setBar]);
  return { value, entries };
}

export function SideColumnTabBarProvider({ value, children }: { value: Registry; children: ReactNode }) {
  return <SideColumnTabBarContext.Provider value={value}>{children}</SideColumnTabBarContext.Provider>;
}

/** The tab pages' paths; Capture has its own. */
const TAB_PATHS = new Set(['/', '/index', '/journal', '/statistics', '/explore']);

/**
 * The navigation of the screen on show. A screen pushed above the tabs, such as a dream
 * or the settings, has none: the column then keeps only the status bar.
 */
export function pickSideColumnTabBar(entries: readonly Entry[], pathname: string | null | undefined): SideColumnTabBar | null {
  const owner: SideColumnTabBarOwner | null = pathname === '/recording'
    ? 'recording'
    : pathname && TAB_PATHS.has(pathname) ? 'tabs' : null;
  if (!owner) return null;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].owner === owner) return entries[index].bar;
  }
  return null;
}

/**
 * Hands this screen's navigation to the side column while there is one, or `null` while
 * the screen shows none (keyboard up, a blocked account). Returns whether the column
 * exists, in which case the screen draws no bar of its own and frees its bottom.
 */
export function useSideColumnTabBar(owner: SideColumnTabBarOwner, bar: SideColumnTabBar | null): boolean {
  const { column, setBar } = useContext(SideColumnTabBarContext);
  const id = useId();
  // Presses reach the latest handlers without handing the shell a new bar on every render.
  const latest = useRef(bar);
  useEffect(() => {
    latest.current = bar;
  });
  const shown = column ? bar : null;
  const activeKey = shown?.activeKey;
  const captureIcon = shown?.captureIcon;
  const capturePressHint = shown?.capturePressHint;
  const capturePress = Boolean(shown?.onCapturePress);
  useEffect(() => {
    if (!activeKey) return undefined;
    setBar(id, {
      id,
      owner,
      bar: {
        activeKey,
        captureIcon,
        capturePressHint,
        onSelect: (key) => latest.current?.onSelect(key),
        onCapturePress: capturePress ? () => latest.current?.onCapturePress?.() : undefined,
      },
    });
    return () => setBar(id, null);
  }, [activeKey, captureIcon, capturePress, capturePressHint, id, owner, setBar]);
  return column !== null;
}

/** Whether the navigation sits in the side column, leaving the bottom of the screens free. */
export function useTabBarInSideColumn(): boolean {
  return useContext(SideColumnTabBarContext).column !== null;
}
