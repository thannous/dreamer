import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { HeaderScrollContext, useScreenScrollValue } from './scrollDepth';

/**
 * Once the page leaves the top, whatever scrolls under the clock and battery melts into
 * the page's ground instead of running into them.
 */
function StatusBarVeil({ scrollY }: { scrollY: SharedValue<number> }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const ground = getNoctaliaDesignTokens(colors, mode).screen.background;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [8, 64], [0, 1], Extrapolation.CLAMP),
  }));
  if (insets.top <= 0) return null;
  const height = insets.top + 28;
  return (
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={[styles.veil, { height }, style]}>
      <LinearGradient colors={[ground, `${ground}F2`, `${ground}00`]} locations={[0, insets.top / height, 1]}
        style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/**
 * A screen that scrolls owns its scroll: its header fades, its paintings drift and its
 * cards move with it, and with `veil` the status bar stays clear of what passes under it.
 * Screens outside such a scope rest at the top whatever another screen did.
 */
export function withHeaderScroll<P extends object>(Screen: React.ComponentType<P>, { veil = true } = {}) {
  function ScrollScopedScreen(props: P) {
    const scrollY = useScreenScrollValue();
    return (
      <HeaderScrollContext.Provider value={scrollY}>
        <Screen {...props} />
        {veil ? <StatusBarVeil scrollY={scrollY} /> : null}
      </HeaderScrollContext.Provider>
    );
  }
  ScrollScopedScreen.displayName = `withHeaderScroll(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return ScrollScopedScreen;
}

const styles = StyleSheet.create({
  veil: { position: 'absolute', top: 0, left: 0, right: 0 },
});
