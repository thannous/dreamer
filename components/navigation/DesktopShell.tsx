import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';

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

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const showSidebar = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT && shouldShowDesktopSidebar(pathname);

  // Keep one wrapper tree whether or not the sidebar shows. Swapping parents
  // would remount the root navigator on a resize or a route change.
  return (
    <View className={showSidebar ? 'flex-1 flex-row' : 'flex-1'}>
      {showSidebar ? <DesktopSidebar /> : null}
      <View className="min-w-0 flex-1">{children}</View>
    </View>
  );
}
