import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
}

export function LoadingState({ message = 'Loading...', size = 'large' }: LoadingStateProps): React.ReactElement {
  const { colors, mode } = useTheme();
  // `ActivityIndicator` takes a colour value, not a style, so this one stays in TS.
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <View className="flex-1 items-center justify-center bg-ink p-6">
      <ActivityIndicator size={size} color={noctalia.accent.text} />
      {message ? (
        <Text className="mt-4 text-center text-body font-sans-medium text-ivory-muted">{message}</Text>
      ) : null}
    </View>
  );
}
