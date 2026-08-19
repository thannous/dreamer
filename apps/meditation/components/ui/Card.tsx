import React from 'react';
import { View, type ViewProps } from 'react-native';

import { BreathingStripe } from '@/components/atmosphere/BreathingStripe';

type Props = ViewProps & {
  /** Adds the champagne stripe that breathes with the app. */
  featured?: boolean;
  className?: string;
};

/**
 * Opaque surface, and the DEFAULT choice.
 *
 * Reach for `GlassCard` only on the one hero surface of a screen — blur is
 * expensive on Android and loses its meaning once everything is frosted.
 */
export function Card({ featured = false, className, children, ...rest }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-xl border border-hairline bg-ink-card ${className ?? ''}`}
      {...rest}>
      {featured ? <BreathingStripe /> : null}
      <View className="p-gutter">{children}</View>
    </View>
  );
}
