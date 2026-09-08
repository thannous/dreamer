import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

const AuthCallbackScreen: React.FC<{ destination?: Href }> = ({ destination = '/recording' }) => {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  useEffect(() => {
    router.replace(destination);
  }, [destination]);

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
      <AtmosphericBackground />
      <ActivityIndicator color={noctalia.accent.text} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
});

export default AuthCallbackScreen;
