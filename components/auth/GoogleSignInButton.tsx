import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { signInWithGoogle, signInWithGoogleWeb } from '@/lib/auth';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { clearStayOnSettingsIntent, requestStayOnSettingsIntent } from '@/lib/navigationIntents';
import { createScopedLogger } from '@/lib/logger';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';

const log = createScopedLogger('[GoogleSignInButton]');

function getErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' ? message : undefined;
}

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    log.debug('User tapped "Continue with Google"');
    try {
      if (Platform.OS === 'web') {
        log.debug('Platform is Web, using OAuth popup');
        requestStayOnSettingsIntent({ persist: true });
        await signInWithGoogleWeb();
        // Supabase handles redirect/popup; session will be captured via onAuthChange
        return;
      }

      log.debug('Platform is Native, using Google Sign-In');
      await signInWithGoogle();
      log.debug('Sign-in successful');
      requestStayOnSettingsIntent();
      // Navigation is handled by auth state listener in settings screen
    } catch (error: unknown) {
      clearStayOnSettingsIntent();
      log.warn('Sign-in failed', error);
      const errorCode = getErrorCode(error);
      const errorMessage = getErrorMessage(error);

      // Don't show error if user cancelled
      if (errorMessage === 'SIGN_IN_CANCELLED' || errorCode === 'SIGN_IN_CANCELLED') {
        log.debug('User cancelled the sign-in dialog');
      } else if (errorMessage?.includes('Play Services') || errorCode === 'PLAY_SERVICES_NOT_AVAILABLE') {
        log.warn('Play Services error detected', error);
        Alert.alert(
          t('auth.google.play_services_title'),
          t('auth.google.play_services_message')
        );
      } else {
        log.warn('Showing generic error alert', { errorCode, errorMessage });
        Alert.alert(
          t('auth.google.error_title'),
          t('auth.google.error_generic')
        );
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
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.textSecondary,
          },
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleGoogleSignIn}
        disabled={loading}
        testID={TID.Button.AuthGoogle}
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <>
            <IconSymbol name="g.circle.fill" size={20} color={colors.textPrimary} />
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{t('auth.google.cta')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
