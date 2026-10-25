import React, { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
 * Built with the iOS 27.1 SDK, the iPhone Duo folded and open on its side (measured in its
 * simulator) gathers the status bar, the camera and the system's bars into one column at
 * one side of the window: its only side safe area. Apple's apps keep their tab bar at the
 * bottom of that column, near the thumb, and ours goes there too. A phone on its side has
 * a safe area at both sides; Android's side insets are a navigation bar or a camera cutout,
 * and the web has none, so the column is iOS's alone.
 */
export function getSideColumn(
  { left, right }: { left: number; right: number },
  os: string = Platform.OS,
): SideColumn | null {
  if (os !== 'ios' || (left > 0 && right > 0)) return null;
  const width = Math.max(left, right);
  return width >= SIDE_COLUMN_MIN_WIDTH ? { side: right > 0 ? 'right' : 'left', width } : null;
}

/** Who shows the navigation: the tab pages, or Capture, which sits above them. */
export type SideColumnTabBarOwner = 'tabs' | 'recording';

/** The routes that show the navigation, each with its destination. */
const NAVIGATION_PATHS = new Map<string, NavigationKey>([
  ['/', 'home'],
  ['/index', 'home'],
  ['/journal', 'journal'],
  ['/recording', 'addDream'],
  ['/statistics', 'stats'],
  ['/explore', 'explore'],
]);

/** What the column's navigation shows, and what its presses do. */
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

/** What a screen hands over: the shell reads the active destination from the route on show. */
export type SideColumnTabBarHandover = Omit<SideColumnTabBar, 'activeKey'>;

type Entry = { id: string; owner: SideColumnTabBarOwner; bar: SideColumnTabBarHandover };
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

/**
 * The navigation of the route on show, its active destination read from that route so it
 * is right in the very render the route changes. A screen pushed above the tabs, such as a
 * dream or the settings, has none: the column then keeps only the status bar.
 */
export function pickSideColumnTabBar(entries: readonly Entry[], pathname: string | null | undefined): SideColumnTabBar | null {
  const activeKey = pathname ? NAVIGATION_PATHS.get(pathname) : undefined;
  if (!activeKey) return null;
  const owner: SideColumnTabBarOwner = activeKey === 'addDream' ? 'recording' : 'tabs';
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].owner === owner) return { ...entries[index].bar, activeKey };
  }
  return null;
}

/**
 * Hands this screen's navigation to the side column while there is one, or `null` while
 * the screen shows none (keyboard up, a blocked account). It lands before the frame is
 * drawn, so the column never shows a frame without it. Returns whether the column exists,
 * in which case the screen draws no bar of its own and frees its bottom.
 */
export function useSideColumnTabBar(owner: SideColumnTabBarOwner, bar: SideColumnTabBarHandover | null): boolean {
  const { column, setBar } = useContext(SideColumnTabBarContext);
  const id = useId();
  // Presses reach the latest handlers without handing the shell a new bar on every render.
  const latest = useRef(bar);
  useLayoutEffect(() => {
    latest.current = bar;
  });
  const shown = column ? bar : null;
  const handedOver = shown !== null;
  const captureIcon = shown?.captureIcon;
  const capturePressHint = shown?.capturePressHint;
  const capturePress = Boolean(shown?.onCapturePress);
  useLayoutEffect(() => {
    if (!handedOver) return undefined;
    setBar(id, {
      id,
      owner,
      bar: {
        captureIcon,
        capturePressHint,
        onSelect: (key) => latest.current?.onSelect(key),
        onCapturePress: capturePress ? () => latest.current?.onCapturePress?.() : undefined,
      },
    });
    return () => setBar(id, null);
  }, [captureIcon, capturePress, capturePressHint, handedOver, id, owner, setBar]);
  return column !== null;
}

/**
 * Whether the window has the side column, where the navigation then belongs: screens keep
 * no room for a bar at their bottom, whether or not the bar shows right now.
 */
export function useTabBarInSideColumn(): boolean {
  return useContext(SideColumnTabBarContext).column !== null;
}
