import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { GlassCardTokens } from '@/constants/theme';
import { useScrollPerf } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MotiView } from '@/lib/moti';

export type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: 'subtle' | 'moderate' | 'strong';
  onPress?: PressableProps['onPress'];
  testID?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
  animationDelay?: number;
};

type GlassCardBaseProps = GlassCardProps & {
  shadow: 'on' | 'off';
  useBlur?: boolean;
};

/**
 * GlassCard component provides a glassmorphism effect card wrapper.
 * Uses BlurView on iOS for true blur effect.
 * Falls back to a semi-transparent background on Android/web.
 */
function GlassCardBase({
  children,
  style,
  intensity = 'moderate',
  onPress,
  testID,
  accessibilityRole,
  accessibilityLabel,
  animationDelay = 0,
  shadow,
  useBlur = true,
}: GlassCardBaseProps) {
  const { colors, mode, shadows } = useTheme();
  const isScrolling = useScrollPerf();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceEffects = isScrolling || prefersReducedMotion;

  // Blur intensity mapping - very light for light mode to preserve colors
  const blurIntensity = mode === 'dark'
    ? {
        subtle: 15,
        moderate: 25,
        strong: 35,
      }[intensity]
    : {
        subtle: 5,
        moderate: 8,
        strong: 12,
      }[intensity];

  // Background opacity - higher for light mode to show colors
  const backgroundOpacity = mode === 'dark'
    ? {
        subtle: 0.3,
        moderate: 0.4,
        strong: 0.5,
      }[intensity]
    : {
        subtle: 0.5,
        moderate: 0.65,
        strong: 0.75,
      }[intensity];

  const isIos = Platform.OS === 'ios';
  const shouldUseBlur = isIos && useBlur && !reduceEffects;

  // Theme-aware glass background color using system colors
  // Convert hex opacity to hex alpha for consistency
  const opacityHex = Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0');
  const glassBackgroundColor = `${colors.backgroundCard}${opacityHex}`;

  // Glass styling
  const glassStyle: ViewStyle = {
    backgroundColor: shouldUseBlur
      ? 'transparent'
      : glassBackgroundColor,
    borderWidth: GlassCardTokens.borderWidth,
    borderColor: colors.divider,
    borderRadius: GlassCardTokens.borderRadius,
    overflow: 'hidden',
    ...(shadow === 'on' && !reduceEffects ? shadows.lg : undefined),
  };

  const content = (
    <>
      {/* BlurView for iOS only */}
      {shouldUseBlur && (
        <BlurView
          intensity={blurIntensity}
          tint={mode === 'dark' ? 'dark' : 'light'}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </>
  );

  const motionFrom = reduceEffects ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 20 };
  const motionTransition = reduceEffects
    ? { type: 'timing' as const, duration: 0 }
    : { type: 'timing' as const, duration: 650, delay: animationDelay };

  const animatedContent = (
    <MotiView
      // Keep cards visible even if animations fail to start (e.g. during screen freezes).
      from={motionFrom}
      animate={{ opacity: 1, translateY: 0 }}
      transition={motionTransition}
      style={[glassStyle, style]}
    >
      {content}
    </MotiView>
  );

  // If onPress provided, wrap in Pressable
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {animatedContent}
      </Pressable>
    );
  }

  return animatedContent;
}

export function GlassCard(props: GlassCardProps) {
  return <GlassCardBase {...props} shadow="on" useBlur />;
}

export function FlatGlassCard(props: GlassCardProps) {
  return <GlassCardBase {...props} shadow="off" useBlur={false} />;
}
