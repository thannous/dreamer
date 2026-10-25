import { usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { SideColumnTabBar } from '@/components/navigation/SideColumnTabBar';
import { DarkTheme } from '@/constants/journalTheme';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { SideGuttersProvider, getScreenInsets } from '@/context/ContentWindowContext';
import {
  SideColumnTabBarProvider,
  getSideColumn,
  pickSideColumnTabBar,
  useSideColumnTabBarRegistry,
} from '@/context/SideColumnTabBarContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Routes that own the whole window on desktop: first-run and account flows,
 * the paywall, the Lucid companion and developer hosts. Every other journal
 * route keeps the sidebar, including Capture and Settings which sit above the
 * tabs in the root stack.
 */
const FULL_WINDOW_PREFIXES = ['/onboarding', '/auth', '/paywall', '/lucid', '/dev'];
/** Routes painted at night whatever the chosen theme, whose gutters must be night too. */
const NIGHT_ONLY_PREFIXES = ['/onboarding', '/sleep-sounds'];
const NIGHT_GROUND = getNoctaliaDesignTokens(DarkTheme, 'dark').screen.background;

function isUnder(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldShowDesktopSidebar(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !isUnder(pathname, FULL_WINDOW_PREFIXES);
}

/**
 * The root of every screen. On the side it leaves the safe areas to the system: the
 * status bar and camera column of the iPhone Duo (folded, or open on its side, in an app
 * built with the iOS 27.1 SDK), a phone's camera when it lies on its side, an Android
 * navigation bar in landscape. Those gutters take the page's ground so the status bar
 * keeps its contrast; screens read their width with `useContentWindow`. The iPhone Duo's
 * column also takes the navigation of the screens that have one, at its bottom.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { left, right } = insets;
  const screenInsets = useMemo(() => getScreenInsets(insets), [insets]);
  const sideColumn = useMemo(() => getSideColumn({ left, right }), [left, right]);
  const sideColumnTabBars = useSideColumnTabBarRegistry(sideColumn);
  const { colors, mode } = useTheme();
  const pathname = usePathname();
  const nightOnly = Boolean(pathname && isUnder(pathname, NIGHT_ONLY_PREFIXES));
  const ground = useMemo(
    () => (nightOnly ? NIGHT_GROUND : getNoctaliaDesignTokens(colors, mode).screen.background),
    [colors, mode, nightOnly],
  );
  const showSidebar = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT && shouldShowDesktopSidebar(pathname);
  const sideColumnTabBar = sideColumn ? pickSideColumnTabBar(sideColumnTabBars.entries, pathname) : null;

  // Keep one wrapper tree whether or not the sidebar or the gutters show. Swapping
  // parents would remount the root navigator on a resize, a fold or a route change.
  return (
    <SideGuttersProvider left={left} right={right}>
      <SideColumnTabBarProvider value={sideColumnTabBars.value}>
        <SafeAreaInsetsContext.Provider value={screenInsets}>
          <View
            className={showSidebar ? 'flex-1 flex-row' : 'flex-1'}
            style={{ paddingLeft: left, paddingRight: right, backgroundColor: ground }}
          >
            {showSidebar ? <DesktopSidebar /> : null}
            <View className="min-w-0 flex-1">{children}</View>
            {/* Drawn here: the screens' views stop at the column, and so do their touches. */}
            {sideColumn && sideColumnTabBar ? (
              <SideColumnTabBar column={sideColumn} bar={sideColumnTabBar} windowHeight={height} bottomInset={insets.bottom} />
            ) : null}
          </View>
        </SafeAreaInsetsContext.Provider>
      </SideColumnTabBarProvider>
    </SideGuttersProvider>
  );
}
