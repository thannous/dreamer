import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemeLayout } from '@/constants/journalTheme';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { signInWithEmailPassword, signOut, signUpWithEmailPassword } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

type Props = {
  isCompact?: boolean;
};

export const EmailAuthCard: React.FC<Props> = ({ isCompact = false }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState<'signin' | 'signup' | 'signout' | null>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const emailValid = useMemo(() => EMAIL_REGEX.test(trimmedEmail), [trimmedEmail]);
  const passwordValid = useMemo(() => password.length >= PASSWORD_MIN_LENGTH, [password]);

  const showEmailError = touched.email && trimmedEmail.length > 0 && !emailValid;
  const showPasswordError = touched.password && password.length > 0 && !passwordValid;

  const isBusy = submitting !== null || authLoading;
  const emailActionsDisabled = isBusy || !emailValid || !passwordValid;

  const resetSensitiveInputs = () => {
    setPassword('');
  };

  const handleSupabaseError = (error: unknown, titleKey: string) => {
    const message = error instanceof Error ? error.message : t('common.unknown_error');
    Alert.alert(t(titleKey), message);
  };

  const attemptSignIn = async () => {
    setTouched({ email: true, password: true });
    if (emailActionsDisabled) return;
    setSubmitting('signin');
    try {
      await signInWithEmailPassword(trimmedEmail, password);
      resetSensitiveInputs();
    } catch (error) {
      handleSupabaseError(error, 'settings.account.alert.signin_failed.title');
    } finally {
      setSubmitting(null);
    }
  };

  const attemptSignUp = async () => {
    setTouched({ email: true, password: true });
    if (emailActionsDisabled) return;
    setSubmitting('signup');
    try {
      await signUpWithEmailPassword(trimmedEmail, password);
      Alert.alert(
        t('settings.account.alert.signup_success.title'),
        t('settings.account.alert.signup_success.message')
      );
      resetSensitiveInputs();
    } catch (error) {
      handleSupabaseError(error, 'settings.account.alert.signup_failed.title');
    } finally {
      setSubmitting(null);
    }
  };

  const attemptSignOut = async () => {
    if (isBusy) return;
    setSubmitting('signout');
    try {
      await signOut();
    } catch (error) {
      handleSupabaseError(error, 'settings.account.alert.signout_failed.title');
    } finally {
      setSubmitting(null);
    }
  };

  if (user) {
    return (
      <View
        style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: colors.backgroundCard }]}
      >
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.account.title')}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          {t('settings.account.description_signed_in')}
        </Text>

        <View
          style={[styles.userInfo, isCompact && styles.userInfoCompact, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Text style={[styles.userLabel, { color: colors.textSecondary }]}>
            {t('settings.account.label.email')}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textPrimary }]}>{user.email}</Text>
        </View>

        <Pressable
          style={[styles.btn, styles.danger, isCompact && styles.btnCompact, isBusy && styles.btnDisabled]}
          onPress={attemptSignOut}
          disabled={isBusy}
        >
          {submitting === 'signout' ? (
            <ActivityIndicator color={colors.backgroundCard} />
          ) : (
            <Text
              style={[styles.btnText, isCompact && styles.btnTextCompact, { color: colors.backgroundCard }]}
              numberOfLines={1}
            >
              {t('settings.account.button.sign_out')}
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: colors.backgroundCard }]}
    >
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
        {t('settings.account.title')}
      </Text>
      <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
        {t('settings.account.description_signed_out')}
      </Text>

      <GoogleSignInButton />

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary }]}
        placeholder={t('settings.account.placeholder.email')}
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (!touched.email) {
            setTouched((prev) => ({ ...prev, email: true }));
          }
        }}
        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
      />
      {showEmailError && (
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {t('auth.email.invalid')}
        </Text>
      )}

      <TextInput
        style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary }]}
        placeholder={t('settings.account.placeholder.password')}
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (!touched.password) {
            setTouched((prev) => ({ ...prev, password: true }));
          }
        }}
        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        secureTextEntry
        textContentType="password"
      />
      {showPasswordError && (
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {t('auth.password.too_short', { count: PASSWORD_MIN_LENGTH })}
        </Text>
      )}

      <View style={[styles.row, isCompact && styles.rowCompact]}>
        <Pressable
          style={[styles.btn, isCompact && styles.btnCompact, { backgroundColor: colors.accent }, (emailActionsDisabled || submitting === 'signup') && styles.btnDisabled]}
          onPress={attemptSignIn}
          disabled={emailActionsDisabled}
        >
          {submitting === 'signin' ? (
            <ActivityIndicator color={colors.backgroundCard} />
          ) : (
            <Text
              style={[styles.btnText, isCompact && styles.btnTextCompact, { color: colors.backgroundCard }]}
              numberOfLines={1}
            >
              {t('settings.account.button.sign_in')}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.btn, isCompact && styles.btnCompact, { backgroundColor: colors.backgroundSecondary }, (emailActionsDisabled || submitting === 'signin') && styles.btnDisabled]}
          onPress={attemptSignUp}
          disabled={emailActionsDisabled}
        >
          {submitting === 'signup' ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text
              style={[styles.btnTextSecondary, isCompact && styles.btnTextCompact, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {t('settings.account.button.sign_up')}
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('settings.account.hint.configure_supabase')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  cardCompact: {
    padding: ThemeLayout.spacing.sm,
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
    marginBottom: ThemeLayout.spacing.xs,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  row: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    marginTop: ThemeLayout.spacing.sm,
  },
  rowCompact: {
    gap: ThemeLayout.spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: {
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: 10,
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
  btnTextCompact: {
    fontSize: 15,
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
  userInfoCompact: {
    padding: ThemeLayout.spacing.sm,
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
  danger: {
    backgroundColor: '#f58c8c',
    marginTop: ThemeLayout.spacing.md,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: ThemeLayout.spacing.xs,
  },
});

export default EmailAuthCard;
