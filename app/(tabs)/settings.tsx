import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, Platform, ScrollView } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { signInWithEmailPassword, signOut, signUpWithEmailPassword } from '@/lib/auth';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useTheme } from '@/context/ThemeContext';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  const isBusy = busy || authLoading;

  const handleSignUp = async () => {
    if (!email || !password || isBusy) return;
    setBusy(true);
    try {
      await signUpWithEmailPassword(email.trim(), password);
      Alert.alert(
        t('settings.account.alert.signup_success.title'),
        t('settings.account.alert.signup_success.message')
      );
      setPassword('');
    } catch (e: any) {
      Alert.alert(
        t('settings.account.alert.signup_failed.title'),
        e?.message ?? t('common.unknown_error')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password || isBusy) return;
    setBusy(true);
    try {
      await signInWithEmailPassword(email.trim(), password);
      setPassword('');
    } catch (e: any) {
      Alert.alert(
        t('settings.account.alert.signin_failed.title'),
        e?.message ?? t('common.unknown_error')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (isBusy) return;
    setBusy(true);
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert(
        t('settings.account.alert.signout_failed.title'),
        e?.message ?? t('common.unknown_error')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!user ? (
          <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.account.title')}
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {t('settings.account.description_signed_out')}
            </Text>

            <GoogleSignInButton />

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
                {t('common.or')}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary }]}
              placeholder={t('settings.account.placeholder.email')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary }]}
              placeholder={t('settings.account.placeholder.password')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.row}>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }, isBusy && styles.btnDisabled]}
                disabled={isBusy}
                onPress={handleSignIn}
              >
                <Text style={[styles.btnText, { color: colors.backgroundCard }]}>
                  {t('settings.account.button.sign_in')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.backgroundSecondary }, isBusy && styles.btnDisabled]}
                disabled={isBusy}
                onPress={handleSignUp}
              >
                <Text style={[styles.btnTextSecondary, { color: colors.textPrimary }]}>
                  {t('settings.account.button.sign_up')}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('settings.account.hint.configure_supabase')}
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.account.title')}
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {t('settings.account.description_signed_in')}
            </Text>

            <View style={[styles.userInfo, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.userLabel, { color: colors.textSecondary }]}>
                {t('settings.account.label.email')}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textPrimary }]}>{user.email}</Text>
            </View>

            <Pressable
              style={[styles.btn, styles.danger, busy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={handleSignOut}
            >
              <Text style={[styles.btnText, { color: colors.backgroundCard }]}>
                {t('settings.account.button.sign_out')}
              </Text>
            </Pressable>
          </View>
        )}

        <ThemeSettingsCard />
        <LanguageSettingsCard />
        <NotificationSettingsCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ThemeLayout.spacing.md,
  },
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: ThemeLayout.spacing.md,
    lineHeight: 20,
  },
  input: {
    borderRadius: ThemeLayout.borderRadius.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
    marginBottom: ThemeLayout.spacing.sm,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  row: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    marginTop: ThemeLayout.spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    backgroundColor: '#dc2626',
    marginTop: ThemeLayout.spacing.md,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  btnTextSecondary: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginTop: ThemeLayout.spacing.sm,
    lineHeight: 18,
  },
  userInfo: {
    borderRadius: ThemeLayout.borderRadius.sm,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.sm,
  },
  userLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
