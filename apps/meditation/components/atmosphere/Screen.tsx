import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { NightBackground, type AtmosphereVariant } from './NightBackground';

type Props = React.PropsWithChildren<{
  variant?: AtmosphereVariant;
  edges?: readonly Edge[];
  className?: string;
}>;

/**
 * Every screen sits on this: atmosphere at the back, safe-area-aware content
 * in front. Screens should never paint their own background colour.
 */
export function Screen({
  children,
  variant = 'subtle',
  edges = ['top', 'bottom'],
  className,
}: Props) {
  return (
    <View className="flex-1 bg-ink">
      <NightBackground variant={variant} />
      {/* zIndex is required on web: an absolutely-positioned sibling paints
          above static ones regardless of DOM order. Harmless on native. */}
      <SafeAreaView
        edges={edges}
        style={{ zIndex: 1 }}
        className={className ?? 'flex-1'}>
        {children}
      </SafeAreaView>
    </View>
  );
}
