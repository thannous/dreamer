import { usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { DarkTheme } from '@/constants/journalTheme';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { SideGuttersProvider } from '@/context/ContentWindowContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Routes that own the whole window on desktop: first-run and account flows,
 * the paywall, the Lucid companion and developer hosts. Every other journal
 * route keeps the sidebar, including Capture and Settings which sit above the
 * tabs in the root stack.
 */
const FULL_WINDOW_PREFIXES = ['/onboarding', '/auth', '/paywall', '/lucid', '/dev'];
/** Routes painted at night whatever the chosen theme, whose gutters must be night too. */
const NIGHT_ONLY_PREFIXES = ['/onboarding'];
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
 * keeps its contrast; screens read their width with `useContentWindow`.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const pathname = usePathname();
  const nightOnly = Boolean(pathname && isUnder(pathname, NIGHT_ONLY_PREFIXES));
  const ground = useMemo(
    () => (nightOnly ? NIGHT_GROUND : getNoctaliaDesignTokens(colors, mode).screen.background),
    [colors, mode, nightOnly],
  );
  const showSidebar = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT && shouldShowDesktopSidebar(pathname);

  // Keep one wrapper tree whether or not the sidebar or the gutters show. Swapping
  // parents would remount the root navigator on a resize, a fold or a route change.
  return (
    <SideGuttersProvider left={left} right={right}>
      <View
        className={showSidebar ? 'flex-1 flex-row' : 'flex-1'}
        style={{ paddingLeft: left, paddingRight: right, backgroundColor: ground }}
      >
        {showSidebar ? <DesktopSidebar /> : null}
        <View className="min-w-0 flex-1">{children}</View>
      </View>
    </SideGuttersProvider>
  );
}
