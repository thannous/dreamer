import { useVideoPlayer, VideoView } from 'expo-video';
import { useIsFocused } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSettings } from '@/context/SettingsContext';

const SOURCES = {
  welcome: require('@/assets/video/welcome.mp4'),
  player: require('@/assets/video/player.mp4'),
  breathe: require('@/assets/video/breathe.mp4'),
  sleep: require('@/assets/video/sleep.mp4'),
} as const;

export type VideoBackgroundName = keyof typeof SOURCES;

type Props = {
  name: VideoBackgroundName;
  /** Dimmed further on screens that carry a lot of text. */
  opacity?: number;
};

/**
 * A looping video behind the atmosphere.
 *
 * It sits UNDER the gradient, the orbits and the veil rather than replacing
 * them: the atmosphere is what keeps text readable, and a video alone would
 * leave titles floating on whatever the frame happens to be doing.
 *
 * It withdraws in three cases, and each one matters more than the effect:
 * reduced motion is switched on, the listener turned backgrounds off, or the
 * screen lost focus — a video decoding behind a screen nobody is looking at is
 * battery spent on nothing.
 */
export function VideoBackground({ name, opacity = 0.55 }: Props) {
  const reducedMotion = useReducedMotion();
  const { videoBackgrounds } = useSettings();
  const isFocused = useIsFocused();

  const enabled = videoBackgrounds && !reducedMotion;

  const player = useVideoPlayer(SOURCES[name], (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (enabled && isFocused) player.play();
    else player.pause();
  }, [enabled, isFocused, player]);

  if (!enabled) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // No zIndex here: `Screen` renders this between the background colour and
      // the atmosphere, so document order already puts it in the right place.
      // A negative zIndex would push it behind the opaque background instead.
      style={[StyleSheet.absoluteFill, { opacity, pointerEvents: 'none' }]}>
      <VideoView
        player={player}
        // Explicit dimensions: absoluteFill alone leaves the web <video> at its
        // intrinsic 300×150.
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}
