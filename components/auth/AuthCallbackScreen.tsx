import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useTheme } from '@/context/ThemeContext';

const AuthCallbackScreen: React.FC = () => {
  const { colors } = useTheme();

  useEffect(() => {
    router.replace('/recording');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AuthCallbackScreen;

