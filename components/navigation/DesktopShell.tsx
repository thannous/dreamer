import { usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
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

export function shouldShowDesktopSidebar(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !FULL_WINDOW_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
  const ground = useMemo(() => getNoctaliaDesignTokens(colors, mode).screen.background, [colors, mode]);
  const pathname = usePathname();
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
