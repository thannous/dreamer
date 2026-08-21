import React from 'react';
import { View } from 'react-native';
import { SafeAreaView as RNSafeAreaView, type Edge } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { NightBackground, type AtmosphereVariant } from './NightBackground';
import { VideoBackground, type VideoBackgroundName } from './VideoBackground';

/**
 * Uniwind only teaches `className` to React Native's own components. On a third
 * party one the prop is silently dropped on native — the class never becomes a
 * style, the view collapses to its content height, and every screen ends up
 * squeezed into a couple hundred points. Web hides this: there `className`
 * reaches the DOM and the CSS applies anyway.
 */
const SafeAreaView = withUniwind(RNSafeAreaView);

type Props = React.PropsWithChildren<{
  variant?: AtmosphereVariant;
  /** Looping video under the atmosphere. Omitted on most screens. */
  video?: VideoBackgroundName;
  /** Dimmer on screens carrying a lot of text. */
  videoOpacity?: number;
  edges?: readonly Edge[];
  className?: string;
}>;

/**
 * Every screen sits on this: atmosphere at the back, safe-area-aware content
 * in front. Screens should never paint their own background colour.
 */
export function Screen({
  children,
  video,
  videoOpacity,
  variant = 'subtle',
  edges = ['top', 'bottom'],
  className,
}: Props) {
  return (
    <View className="flex-1 bg-ink">
      {/* Order matters and is the whole layering: colour, then video, then the
          atmosphere that keeps text readable over whatever the video does. */}
      {video ? <VideoBackground name={video} opacity={videoOpacity} /> : null}
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
