import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useAuthReturnIntent } from '@/hooks/useAuthReturnIntent';

const AuthCallbackScreen: React.FC<{ destination?: Href }> = ({ destination = '/recording' }) => {
  const { colors, mode } = useTheme();
  const { intent, ready } = useAuthReturnIntent();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  useEffect(() => {
    // The root owns this return after auth and onboarding have settled. Do not
    // race it with the callback screen's default Capture navigation.
    if (destination === '/recording' && (!ready || intent)) return;
    router.replace(destination);
  }, [destination, intent, ready]);

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
