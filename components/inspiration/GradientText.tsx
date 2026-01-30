import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import React, { type ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

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
  colors = ['#E9D5FF', '#FDA481'], // lavender to salmon (dream colors)
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  ...textProps
}: GradientTextProps) {
  const isWeb = Platform.OS === 'web';

  // On web, fall back to solid color (first color in gradient)
  if (isWeb) {
    return (
      <Text {...textProps} style={[style, { color: colors[0] }]}>
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
        colors={colors}
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
