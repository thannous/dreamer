import { Drawer } from 'expo-router/drawer';
import React from 'react';

import { DrawerContent } from '@/components/navigation/DrawerContent';
import { useTheme } from '@/context/ThemeContext';

/**
 * A drawer wrapped around the tabs.
 *
 * The hierarchy is declared by the folders — `(drawer)/(tabs)` — rather than by
 * a config file, which is what keeps the two navigators from fighting over
 * gestures and state.
 *
 * Only the tabs live in here. Settings, help and legal stay in the root stack
 * where their own sub-navigation already lives; the panel pushes to them. A
 * drawer is a way in, not a reason to move screens.
 */
export default function DrawerLayout() {
  const { mode } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        // `front` slides the panel over the app instead of pushing it aside:
        // the atmosphere behind stays exactly where it was, and the panel can
        // frost what it covers rather than revealing a bare edge.
        drawerType: 'front',
        drawerStyle: { width: 296, backgroundColor: 'transparent' },
        // Deliberately narrow. The root stack owns an edge-swipe-back on every
        // screen pushed above the tabs, and a wide activation zone here would
        // take that gesture away.
        swipeEdgeWidth: 40,
        overlayColor: mode === 'dark' ? 'rgba(3, 4, 13, 0.55)' : 'rgba(42, 40, 56, 0.28)',
      }}>
      <Drawer.Screen name="(tabs)" />
    </Drawer>
  );
}
