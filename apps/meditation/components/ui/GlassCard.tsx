import { BlurView } from 'expo-blur';
import React from 'react';
import { View, type ViewProps } from 'react-native';

import { BreathingStripe } from '@/components/atmosphere/BreathingStripe';
import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { GlassOpacity, Radius } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type Props = ViewProps & {
  featured?: boolean;
  className?: string;
};

/**
 * Translucent surface that lets the atmosphere bleed through: 30% fill at
 * night, 96% on paper (a near-opaque card is what keeps daylight readable),
 * finished with a film of grain so it reads as misted glass rather than as a
 * stock system material.
 *
 * SUPPORTING TEXTURE ONLY — at most one or two per screen, never inside a
 * scrolling list. `BlurView` is costly on Android, and frosting everything
 * flattens the hierarchy it is supposed to create. Use `Card` elsewhere.
 */
export function GlassCard({ featured = false, className, children, ...rest }: Props) {
  const { mode, colors } = useTheme();

  return (
    <View
      className={`overflow-hidden rounded-xl border border-hairline ${className ?? ''}`}
      style={{ borderRadius: Radius.xl }}
      {...rest}>
      <BlurView
        intensity={mode === 'dark' ? 24 : 16}
        tint={mode === 'dark' ? 'dark' : 'light'}
        // `glassTint` and not `backgroundCard`: the card colour is an rgba string
        // now, and appending an alpha to it would produce nonsense.
        style={{ backgroundColor: colors.glassTint + toHex(GlassOpacity[mode]) }}>
        <GrainOverlay />
        {/* zIndex keeps content above the absolutely-positioned grain on web. */}
        <View style={{ zIndex: 1 }}>
          {featured ? <BreathingStripe /> : null}
          <View className="p-gutter">{children}</View>
        </View>
      </BlurView>
    </View>
  );
}

const toHex = (opacity: number): string =>
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
