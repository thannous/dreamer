import { View, type ViewProps } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const overrideColor = mode === 'dark' ? darkColor : lightColor;
  const backgroundColor = overrideColor ?? noctalia.screen.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
