import { Fonts } from '@/constants/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
}

export function LoadingState({ message = 'Loading...', size = 'large' }: LoadingStateProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#8C9EFF" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#131022',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#8C9EFF',
    textAlign: 'center',
  },
});
