import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, signInWithGoogleWeb } from '@/lib/auth';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        await signInWithGoogleWeb();
        // Supabase handles redirect/popup; session will be captured via onAuthChange
        return;
      }

      const user = await signInWithGoogle();
      console.log('Successfully signed in with Google:', user.email);
      // Navigation is handled by auth state listener in settings screen
    } catch (error: any) {
      // Don't show error if user cancelled
      if (error.message === 'SIGN_IN_CANCELLED') {
        console.log('User cancelled Google Sign-In');
      } else if (error.message?.includes('Play Services')) {
        Alert.alert(
          t('auth.google.play_services_title'),
          t('auth.google.play_services_message')
        );
      } else {
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
