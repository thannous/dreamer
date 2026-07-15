import MaskedView from '@expo/ui/community/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type GradientTextProps = {
  children: ReactNode;
  colors?: readonly [string, string, ...string[]];
  style?: TextStyle;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
} & Omit<TextProps, 'style'>;

/**
 * GradientText component renders text with a gradient color effect.
 * Uses MaskedView to apply gradient to text on iOS/Android.
 * Falls back to first color on web (or can use CSS gradient with dangerouslySetInnerHTML).
 */
export function GradientText({
  children,
  colors,
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  ...textProps
}: GradientTextProps) {
  const theme = useTheme();
  const noctalia = getNoctaliaDesignTokens(theme.colors, theme.mode);
  const resolvedColors = colors ?? ([noctalia.text.primary, noctalia.accent.base] as const);
  const isWeb = Platform.OS === 'web';

  // On web, fall back to solid color (first color in gradient)
  if (isWeb) {
    return (
      <Text {...textProps} style={[style, { color: resolvedColors[0] }]}>
        {children}
      </Text>
    );
  }

  // On native, use MaskedView with LinearGradient
  return (
    <MaskedView
      maskElement={
        <Text {...textProps} style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={resolvedColors}
        start={start}
        end={end}
      >
        <Text {...textProps} style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
