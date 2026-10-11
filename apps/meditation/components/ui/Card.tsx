import React from 'react';
import { View, type ViewProps } from 'react-native';

import { BreathingStripe } from '@/components/atmosphere/BreathingStripe';

import { ArtworkGlassPanel } from './ArtworkGlassPanel';

type Props = ViewProps & {
  /** Adds the champagne stripe that breathes with the app. */
  featured?: boolean;
  className?: string;
};

/**
 * Shared translucent material, also used by the world-facing screens.
 *
 * Reach for `GlassCard` only on the one hero surface of a screen — blur is
 * expensive on Android and loses its meaning once everything is frosted.
 */
export function Card({ featured = false, className, children, ...rest }: Props) {
  return (
    <ArtworkGlassPanel
      className={className}
      {...rest}>
      {featured ? <BreathingStripe /> : null}
      <View className="p-gutter">{children}</View>
    </ArtworkGlassPanel>
  );
}
