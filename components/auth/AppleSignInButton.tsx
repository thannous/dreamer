import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { signInWithApple } from '@/lib/auth';
import { createScopedLogger } from '@/lib/logger';
import { clearStayOnSettingsIntent, requestStayOnSettingsIntent } from '@/lib/navigationIntents';
import { TID } from '@/lib/testIDs';

const log = createScopedLogger('[AppleSignInButton]');

function getErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' ? message : undefined;
}

export default function AppleSignInButton({
  returnTo = '/(tabs)/settings',
}: {
  returnTo?: '/(tabs)/settings' | '/lucid/(tabs)/settings';
}) {
  const [loading, setLoading] = useState(false);
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  if (Platform.OS !== 'ios') {
    return null;
  }

  const handleAppleSignIn = async () => {
    setLoading(true);
    log.debug('User tapped "Continue with Apple"');
    try {
      requestStayOnSettingsIntent({ destination: returnTo });
      await signInWithApple();
      log.debug('Sign-in successful');
    } catch (error: unknown) {
      clearStayOnSettingsIntent();
      log.warn('Sign-in failed', error);
      const errorCode = getErrorCode(error);
      const errorMessage = getErrorMessage(error);

      if (errorMessage === 'SIGN_IN_CANCELLED' || errorCode === 'ERR_REQUEST_CANCELED') {
        log.debug('User cancelled the sign-in dialog');
      } else if (errorMessage?.includes('not available')) {
        Alert.alert(t('auth.apple.unavailable_title'), t('auth.apple.unavailable_message'));
      } else {
        Alert.alert(t('auth.apple.error_title'), t('auth.apple.error_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: noctalia.surface.active,
            borderColor: noctalia.surface.borderStrong,
          },
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleAppleSignIn}
        disabled={loading}
        testID={TID.Button.AuthApple}
      >
        {loading ? (
          <ActivityIndicator color={noctalia.text.primary} size="small" />
        ) : (
          <Text style={[styles.buttonText, { color: noctalia.text.primary }]}>{t('auth.apple.cta')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: ThemeLayout.spacing.sm,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    gap: ThemeLayout.spacing.sm,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
});
