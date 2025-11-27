import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AuthApiError, isAuthApiError } from '@supabase/auth-js';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import EmailVerificationBanner from '@/components/auth/EmailVerificationBanner';
import {
  resendVerificationEmail,
  signInMock,
  signInWithEmailPassword,
  signOut,
  signUpWithEmailPassword,
} from '@/lib/auth';
import { TID } from '@/lib/testIDs';
import type { MockProfile } from '@/lib/auth';
import { requestStayOnSettingsIntent } from '@/lib/navigationIntents';
import { isSupabaseConfigured } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const isMockModeEnabled =
  ((process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_MOCK_MODE ?? '') === 'true';

const mockProfiles: { profile: MockProfile; titleKey: string; subtitleKey: string }[] = [
  {
    profile: 'new',
    titleKey: 'settings.account.mock.profile.new',
    subtitleKey: 'settings.account.mock.profile.new_hint',
  },
  {
    profile: 'existing',
    titleKey: 'settings.account.mock.profile.existing',
    subtitleKey: 'settings.account.mock.profile.existing_hint',
  },
  {
    profile: 'premium',
    titleKey: 'settings.account.mock.profile.premium',
    subtitleKey: 'settings.account.mock.profile.premium_hint',
  },
];

const isUnverifiedEmailError = (error: unknown): error is AuthApiError => {
  if (!isAuthApiError(error)) {
    return false;
  }

  const code = error.code;
  const message = (error.message ?? '').toLowerCase();
  const mentionsConfirmation = message.includes('confirm') || message.includes('verification');

  return error.status === 400 && (code === 'email_not_confirmed' || mentionsConfirmation);
};

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
  const [mockProfileLoading, setMockProfileLoading] = useState<MockProfile | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const emailValid = useMemo(() => EMAIL_REGEX.test(trimmedEmail), [trimmedEmail]);
  const passwordValid = useMemo(() => password.length >= PASSWORD_MIN_LENGTH, [password]);

  const showEmailError = touched.email && trimmedEmail.length > 0 && !emailValid;
  const showPasswordError = touched.password && password.length > 0 && !passwordValid;

  const isMockBusy = mockProfileLoading !== null;
  const isBusy = submitting !== null || authLoading || isMockBusy;
  const emailActionsDisabled = isBusy || !emailValid || !passwordValid;
  const showSupabaseConfigHint = !isSupabaseConfigured && !isMockModeEnabled;

  const resetSensitiveInputs = () => {
    setPassword('');
  };

  const handleSupabaseError = (error: unknown, titleKey: string) => {
    if (isUnverifiedEmailError(error)) {
      setUnverifiedEmail(trimmedEmail);
      setResendStatus('idle');
      return;
    }
    const message = error instanceof Error ? error.message : t('common.unknown_error');
    Alert.alert(t(titleKey), message);
  };

  const attemptSignIn = async () => {
    setTouched({ email: true, password: true });
    if (emailActionsDisabled) return;
    setSubmitting('signin');
    try {
      await signInWithEmailPassword(trimmedEmail, password);
      setUnverifiedEmail(null);
      setResendStatus('idle');
      requestStayOnSettingsIntent();
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
      requestStayOnSettingsIntent();
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

  const handleMockSignIn = async (profile: MockProfile) => {
    if (!isMockModeEnabled) return;
    setMockProfileLoading(profile);
    try {
      await signInMock(profile);
      requestStayOnSettingsIntent();
    } catch (error) {
      handleSupabaseError(error, 'settings.account.alert.signin_failed.title');
    } finally {
      setMockProfileLoading((current) => (current === profile ? null : current));
    }
  };

  const handleFormSubmit = (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }
    attemptSignIn();
  };

  const resendStatusMessage = useMemo(() => {
    if (resendStatus === 'success') {
      return t('settings.account.banner.unverified.success');
    }
    if (resendStatus === 'error') {
      return t('settings.account.banner.unverified.error');
    }
    return null;
  }, [resendStatus, t]);

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendStatus === 'sending') {
      return;
    }
    setResendStatus('sending');
    try {
      await resendVerificationEmail(unverifiedEmail);
      setResendStatus('success');
      requestStayOnSettingsIntent();
    } catch (error) {
      if (__DEV__) {
        console.warn('[EmailAuthCard] resend verification failed', error);
      }
      setResendStatus('error');
    }
  };

  useEffect(() => {
    if (unverifiedEmail && trimmedEmail !== unverifiedEmail) {
      setUnverifiedEmail(null);
      setResendStatus('idle');
    }
  }, [trimmedEmail, unverifiedEmail]);

  const resendStatusColor = resendStatus === 'error' ? colors.accent : colors.textSecondary;

  const emailPasswordForm = (
    <>
      <TextInput
        testID={TID.Input.AuthEmail}
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
        testID={TID.Input.AuthPassword}
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
        onSubmitEditing={attemptSignIn}
      />
      {showPasswordError && (
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {t('auth.password.too_short', { count: PASSWORD_MIN_LENGTH })}
        </Text>
      )}

      <View style={[styles.row, isCompact && styles.rowCompact]}>
        <Pressable
          testID={TID.Button.AuthSignIn}
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
          testID={TID.Button.AuthSignUp}
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

      {showSupabaseConfigHint && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('settings.account.hint.configure_supabase')}
        </Text>
      )}
    </>
  );

  const authForm = Platform.OS === 'web'
    ? React.createElement(
        'form',
        { style: { width: '100%' }, onSubmit: handleFormSubmit },
        emailPasswordForm
      )
    : emailPasswordForm;

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

        <EmailVerificationBanner isCompact={isCompact} />

        <View
          style={[styles.userInfo, isCompact && styles.userInfoCompact, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Text style={[styles.userLabel, { color: colors.textSecondary }]}>
            {t('settings.account.label.email')}
          </Text>
          <Text
            testID={TID.Text.AuthEmail}
            style={[styles.userEmail, { color: colors.textPrimary }]}
          >
            {user.email}
          </Text>
        </View>

        <Pressable
          style={[styles.btn, styles.danger, isCompact && styles.btnCompact, isBusy && styles.btnDisabled]}
          onPress={attemptSignOut}
          disabled={isBusy}
          testID={TID.Button.AuthSignOut}
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

      {unverifiedEmail ? (
        <View
          style={[
            styles.unverifiedBanner,
            isCompact && styles.unverifiedBannerCompact,
            { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider },
          ]}
        >
          <Text style={[styles.unverifiedTitle, { color: colors.textPrimary }]}>
            {t('settings.account.banner.unverified.title')}
          </Text>
          <Text style={[styles.unverifiedMessage, { color: colors.textSecondary }]}>
            {t('settings.account.banner.unverified.message')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.unverifiedAction,
              pressed && styles.unverifiedActionPressed,
              resendStatus === 'sending' && styles.unverifiedActionDisabled,
              {
                borderColor: colors.accent,
                backgroundColor: colors.backgroundCard,
              },
            ]}
            onPress={handleResendVerification}
            disabled={resendStatus === 'sending'}
            testID={TID.Button.AuthResendVerification}
          >
            {resendStatus === 'sending' ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={[styles.unverifiedActionText, { color: colors.textPrimary }]}>
                {t('settings.account.banner.unverified.action')}
              </Text>
            )}
          </Pressable>
          {resendStatusMessage ? (
            <Text style={[styles.unverifiedStatus, { color: resendStatusColor }]} testID={TID.Text.AuthEmailVerificationStatus}>
              {resendStatusMessage}
            </Text>
          ) : null}
        </View>
      ) : null}

      {isMockModeEnabled ? (
        <>
          <View style={[styles.mockSection, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.mockSectionTitle, { color: colors.textPrimary }]}>
              {t('settings.account.mock.quick_title')}
            </Text>
            <Text style={[styles.mockSectionSubtitle, { color: colors.textSecondary }]}>
              {t('settings.account.mock.quick_description')}
            </Text>
            <View style={styles.mockButtonsColumn}>
              {mockProfiles.map(({ profile, titleKey, subtitleKey }) => {
                const loading = mockProfileLoading === profile;
                return (
                  <Pressable
                    key={profile}
                    testID={TID.Button.MockProfile(profile)}
                    style={({ pressed }) => [
                      styles.mockButton,
                      { borderColor: colors.divider, backgroundColor: colors.backgroundCard },
                      pressed && styles.mockButtonPressed,
                      (loading || isBusy) && styles.mockButtonDisabled,
                    ]}
                    onPress={() => handleMockSignIn(profile)}
                    disabled={loading || isBusy}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.textPrimary} size="small" />
                    ) : (
                      <>
                        <Text style={[styles.mockButtonTitle, { color: colors.textPrimary }]}>
                          {t(titleKey)}
                        </Text>
                        <Text style={[styles.mockButtonSubtitle, { color: colors.textSecondary }]}>
                          {t(subtitleKey)}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
          </View>
        </>
      ) : (
        <>
          <GoogleSignInButton />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
          </View>
        </>
      )}

      {authForm}
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
    width: '100%',
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
  mockSection: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
  },
  mockSectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  mockSectionSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    marginTop: 4,
  },
  mockButtonsColumn: {
    marginTop: ThemeLayout.spacing.sm,
    gap: ThemeLayout.spacing.xs,
  },
  mockButton: {
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    padding: ThemeLayout.spacing.sm,
  },
  mockButtonPressed: {
    opacity: 0.9,
  },
  mockButtonDisabled: {
    opacity: 0.6,
  },
  mockButtonTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  mockButtonSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  unverifiedBanner: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  unverifiedBannerCompact: {
    padding: ThemeLayout.spacing.sm,
  },
  unverifiedTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.xs,
  },
  unverifiedMessage: {
    fontSize: 14,
    marginBottom: ThemeLayout.spacing.sm,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  unverifiedAction: {
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    paddingVertical: ThemeLayout.spacing.xs,
    paddingHorizontal: ThemeLayout.spacing.sm,
    alignSelf: 'flex-start',
  },
  unverifiedActionPressed: {
    opacity: 0.8,
  },
  unverifiedActionDisabled: {
    opacity: 0.6,
  },
  unverifiedActionText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  unverifiedStatus: {
    marginTop: ThemeLayout.spacing.xs,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});

export default EmailAuthCard;
