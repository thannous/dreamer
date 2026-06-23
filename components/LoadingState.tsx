import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
}

export function LoadingState({ message = 'Loading...', size = 'large' }: LoadingStateProps): React.ReactElement {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
      <ActivityIndicator size={size} color={noctalia.accent.base} />
      {message && <Text style={[styles.message, { color: noctalia.text.secondary }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
});
