import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, StyleSheet, type ViewStyle } from 'react-native';

import { GlassCardTokens } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { MotiView } from '@/lib/moti';

type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: 'subtle' | 'moderate' | 'strong';
  onPress?: PressableProps['onPress'];
  testID?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
  enableAnimation?: boolean;
  animationDelay?: number;
  disableShadow?: boolean;
};

/**
 * GlassCard component provides a glassmorphism effect card wrapper.
 * Uses BlurView on iOS/Android for true blur effect.
 * Falls back to semi-transparent background on web or if blur unavailable.
 */
export function GlassCard({
  children,
  style,
  intensity = 'moderate',
  onPress,
  testID,
  accessibilityRole,
  accessibilityLabel,
  enableAnimation = true,
  animationDelay = 0,
  disableShadow = false,
}: GlassCardProps) {
  const { colors, shadows, mode } = useTheme();

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

  const isWeb = Platform.OS === 'web';

  // Theme-aware glass background color using system colors
  // Convert hex opacity to hex alpha for consistency
  const opacityHex = Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0');
  const glassBackgroundColor = `${colors.backgroundCard}${opacityHex}`;

  // Glass styling
  const glassStyle: ViewStyle = {
    backgroundColor: isWeb
      ? glassBackgroundColor
      : 'transparent',
    borderWidth: GlassCardTokens.borderWidth,
    borderColor: colors.divider,
    borderRadius: GlassCardTokens.borderRadius,
    overflow: 'hidden',
    ...(disableShadow ? undefined : shadows.lg),
  };

  const content = (
    <>
      {/* BlurView for iOS/Android only */}
      {!isWeb && (
        <BlurView
          intensity={blurIntensity}
          tint={mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </>
  );

  // With animation wrapper
  const animatedContent = enableAnimation ? (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 650, delay: animationDelay }}
      style={[glassStyle, style]}
    >
      {content}
    </MotiView>
  ) : (
    <MotiView style={[glassStyle, style]}>
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
