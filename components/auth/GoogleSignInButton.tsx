import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, signInWithGoogleWeb } from '@/lib/auth';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { clearStayOnSettingsIntent, requestStayOnSettingsIntent } from '@/lib/navigationIntents';

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    console.log('[GoogleSignInButton] User tapped "Continue with Google"');
    try {
      if (Platform.OS === 'web') {
        console.log('[GoogleSignInButton] Platform is Web, using OAuth popup');
        requestStayOnSettingsIntent({ persist: true });
        await signInWithGoogleWeb();
        // Supabase handles redirect/popup; session will be captured via onAuthChange
        return;
      }

      console.log('[GoogleSignInButton] Platform is Native, using Google Sign-In');
      const user = await signInWithGoogle();
      console.log('[GoogleSignInButton] ✓ Sign-in successful:', user.email);
      requestStayOnSettingsIntent();
      // Navigation is handled by auth state listener in settings screen
    } catch (error: any) {
      clearStayOnSettingsIntent();
      console.error('[GoogleSignInButton] ❌ Sign-in failed');
      console.error('[GoogleSignInButton] Error message:', error.message);
      console.error('[GoogleSignInButton] Full error:', error);

      // Don't show error if user cancelled
      if (error.message === 'SIGN_IN_CANCELLED') {
        console.log('[GoogleSignInButton] User cancelled the sign-in dialog');
      } else if (error.message?.includes('Play Services')) {
        console.error('[GoogleSignInButton] Play Services error detected');
        Alert.alert(
          t('auth.google.play_services_title'),
          t('auth.google.play_services_message')
        );
      } else {
        console.error('[GoogleSignInButton] Showing generic error alert:', error.message);
        Alert.alert(
          t('auth.google.error_title'),
          error.message || t('auth.google.error_generic')
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
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
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
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
});
