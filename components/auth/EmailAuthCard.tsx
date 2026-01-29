import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AuthApiError, isAuthApiError } from '@supabase/auth-js';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts, GlassCardTokens } from '@/constants/theme';
import { EmailVerificationDialog } from '@/components/auth/EmailVerificationDialog';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import EmailVerificationBanner from '@/components/auth/EmailVerificationBanner';
import { EyeIcon, EyeOffIcon } from '@/components/icons/DreamIcons';
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
import { isMockModeEnabled as isMockModeEnabledEnv } from '@/lib/env';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const isMockModeEnabled = isMockModeEnabledEnv();
const VERIFICATION_POLL_INTERVAL_MS = 15000;
const RESEND_COOLDOWN_MS = 60000;

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
  const { colors, mode } = useTheme();
  const cardBg = GlassCardTokens.getBackground(colors.backgroundCard, mode);
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState<'signin' | 'signup' | 'signout' | null>(null);
  const [mockProfileLoading, setMockProfileLoading] = useState<MockProfile | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    password: string;
    visible: boolean;
  } | null>(null);
  const [verificationPolling, setVerificationPolling] = useState(false);
  const [lastVerificationEmailSentAt, setLastVerificationEmailSentAt] = useState<number | null>(null);
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [authErrorSheet, setAuthErrorSheet] = useState<{
    visible: boolean;
    titleKey: string;
    messageKey: string | null;
  }>({ visible: false, titleKey: '', messageKey: null });

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const emailValid = useMemo(() => EMAIL_REGEX.test(trimmedEmail), [trimmedEmail]);
  const passwordValid = useMemo(() => password.length >= PASSWORD_MIN_LENGTH, [password]);

  const showEmailError = touched.email && trimmedEmail.length > 0 && !emailValid;
  const showPasswordError = touched.password && password.length > 0 && !passwordValid;

  const isMockBusy = mockProfileLoading !== null;
  const isBusy = submitting !== null || authLoading || isMockBusy;
  const emailActionsDisabled = isBusy || !emailValid || !passwordValid;
  const showSupabaseConfigHint = !isSupabaseConfigured && !isMockModeEnabled;
  const resendCooldownRemainingMs = useMemo(() => {
    if (!lastVerificationEmailSentAt) {
      return 0;
    }
    return Math.max(0, RESEND_COOLDOWN_MS - (cooldownTick - lastVerificationEmailSentAt));
  }, [cooldownTick, lastVerificationEmailSentAt]);
  const resendCooldownSeconds = Math.ceil(resendCooldownRemainingMs / 1000);

  const resetSensitiveInputs = useCallback(() => {
    setPassword('');
    setPasswordVisible(false);
  }, []);

  const clearPendingVerification = useCallback(() => {
    setPendingVerification(null);
    setUnverifiedEmail(null);
    setResendStatus('idle');
    setLastVerificationEmailSentAt(null);
    setVerificationSuccess(false);
  }, []);

  const startVerificationFlow = useCallback(
    (
      emailForVerification: string,
      passwordForVerification: string,
      showDialog = true,
      lastSentAt: number | null = null
    ) => {
      const normalizedEmail = emailForVerification.trim();
      const lastSentTimestamp = lastSentAt ?? Date.now();
      setPendingVerification({
        email: normalizedEmail,
        password: passwordForVerification,
        visible: showDialog,
      });
      setUnverifiedEmail(normalizedEmail);
      setResendStatus('idle');
      setLastVerificationEmailSentAt(lastSentTimestamp);
      setCooldownTick(lastSentTimestamp);
    },
    []
  );

  const handleSupabaseError = (error: unknown, titleKey: string) => {
    if (isUnverifiedEmailError(error)) {
      startVerificationFlow(trimmedEmail, password, true, lastVerificationEmailSentAt);
      return;
    }
    if (__DEV__) {
      console.log('[EmailAuthCard] handleSupabaseError', {
        titleKey,
        error,
      });
    }
    // For sign-in errors, use a user-friendly message key; for others, show generic message
    const messageKey = titleKey === 'settings.account.alert.signin_failed.title'
      ? 'settings.account.alert.signin_failed.message'
      : null;
    setAuthErrorSheet({ visible: true, titleKey, messageKey });
  };

  const closeAuthErrorSheet = useCallback(() => {
    setAuthErrorSheet((prev) => ({ ...prev, visible: false }));
  }, []);

  const attemptSignIn = async () => {
    setTouched({ email: true, password: true });
    if (emailActionsDisabled) return;
    if (__DEV__) {
      console.log('[EmailAuthCard] attemptSignIn', {
        email: trimmedEmail,
      });
    }
    setSubmitting('signin');
    try {
      await signInWithEmailPassword(trimmedEmail, password);
      if (__DEV__) {
        console.log('[EmailAuthCard] signInWithEmailPassword success', {
          email: trimmedEmail,
        });
      }
      clearPendingVerification();
      requestStayOnSettingsIntent();
      if (__DEV__) {
        console.log('[EmailAuthCard] requested stay-on-settings intent');
      }
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
    const passwordForVerification = password;
    setSubmitting('signup');
    try {
      const newUser = await signUpWithEmailPassword(trimmedEmail, passwordForVerification, language);
      const needsVerification = !newUser?.email_confirmed_at;
      if (needsVerification) {
        startVerificationFlow(trimmedEmail, passwordForVerification, true, Date.now());
      } else {
        clearPendingVerification();
      }
      requestStayOnSettingsIntent();
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
      clearPendingVerification();
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

  const pollForVerification = useCallback(async () => {
    if (
      !pendingVerification ||
      verificationPolling ||
      submitting !== null ||
      authLoading ||
      isMockBusy ||
      user ||
      verificationSuccess
    ) {
      return;
    }

    setVerificationPolling(true);
    try {
      await signInWithEmailPassword(pendingVerification.email, pendingVerification.password);
      // Show success state briefly before closing
      setVerificationSuccess(true);
      requestStayOnSettingsIntent();
      resetSensitiveInputs();
      // Close dialog after showing success animation
      setTimeout(() => {
        clearPendingVerification();
      }, 1500);
    } catch (error) {
      if (!isUnverifiedEmailError(error) && __DEV__) {
        console.warn('[EmailAuthCard] verification poll failed', error);
      }
    } finally {
      setVerificationPolling(false);
    }
  }, [
    authLoading,
    clearPendingVerification,
    isMockBusy,
    pendingVerification,
    resetSensitiveInputs,
    submitting,
    user,
    verificationPolling,
    verificationSuccess,
  ]);

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
  const resendCooldownMessage = useMemo(() => {
    if (resendCooldownRemainingMs > 0) {
      return t('settings.account.verification.resend_in', { seconds: resendCooldownSeconds });
    }
    return null;
  }, [resendCooldownRemainingMs, resendCooldownSeconds, t]);
  const resendDisabled = resendStatus === 'sending' || resendCooldownRemainingMs > 0;

  const handleResendVerification = async () => {
    const targetEmail = unverifiedEmail ?? pendingVerification?.email;
    if (!targetEmail || resendDisabled) {
      return;
    }
    setResendStatus('sending');
    try {
      await resendVerificationEmail(targetEmail);
      const now = Date.now();
      setLastVerificationEmailSentAt(now);
      setCooldownTick(now);
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
    if (pendingVerification && trimmedEmail !== pendingVerification.email) {
      clearPendingVerification();
    }
  }, [clearPendingVerification, pendingVerification, trimmedEmail, unverifiedEmail]);

  useEffect(() => {
    if (!pendingVerification && !lastVerificationEmailSentAt) {
      return;
    }
    const tick = setInterval(() => {
      setCooldownTick(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [lastVerificationEmailSentAt, pendingVerification]);

  useEffect(() => {
    if (!pendingVerification || user) {
      return;
    }
    const interval = setInterval(() => {
      pollForVerification();
    }, VERIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pendingVerification, pollForVerification, user]);

  useEffect(() => {
    if (user) {
      clearPendingVerification();
    }
  }, [clearPendingVerification, user]);

  const resendStatusColor = resendStatus === 'error' ? colors.accent : colors.textSecondary;
  const verificationEmail = pendingVerification?.email ?? unverifiedEmail ?? trimmedEmail;
  const verificationVisible = Boolean(pendingVerification?.visible && !user);
  const resendButtonLabel = t('settings.account.banner.unverified.action');
  const passwordToggleLabel = passwordVisible ? t('auth.password.hide') : t('auth.password.show');
  const passwordToggleColor = passwordVisible ? colors.textPrimary : colors.textSecondary;
  const handleCloseVerificationDialog = useCallback(() => {
    setPendingVerification((current) => (current ? { ...current, visible: false } : null));
  }, []);

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

      <View style={styles.inputWithToggle}>
        <TextInput
          testID={TID.Input.AuthPassword}
          style={[
            styles.input,
            styles.inputWithToggleField,
            { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary },
          ]}
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
          secureTextEntry={!passwordVisible}
          textContentType="password"
          onSubmitEditing={attemptSignIn}
        />
        <Pressable
          testID={TID.Button.AuthTogglePassword}
          accessibilityRole="button"
          accessibilityLabel={passwordToggleLabel}
          hitSlop={8}
          onPress={() => setPasswordVisible((prev) => !prev)}
          style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
        >
          {passwordVisible ? (
            <EyeIcon size={18} color={passwordToggleColor} />
          ) : (
            <EyeOffIcon size={18} color={passwordToggleColor} slashColor={colors.backgroundSecondary} />
          )}
        </Pressable>
      </View>
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

  const cardContent = user ? (
    <View
      style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GlassCardTokens.borderWidth }]}
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
  ) : (
    <View
      style={[styles.card, isCompact && styles.cardCompact, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GlassCardTokens.borderWidth }]}
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
              resendDisabled && styles.unverifiedActionDisabled,
              {
                borderColor: colors.accent,
                backgroundColor: colors.backgroundCard,
              },
            ]}
            onPress={handleResendVerification}
            disabled={resendDisabled}
            testID={TID.Button.AuthResendVerification}
          >
            {resendStatus === 'sending' ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={[styles.unverifiedActionText, { color: colors.textPrimary }]}>
                {resendButtonLabel}
              </Text>
            )}
          </Pressable>
          {resendStatusMessage ? (
            <Text style={[styles.unverifiedStatus, { color: resendStatusColor }]} testID={TID.Text.AuthEmailVerificationStatus}>
              {resendStatusMessage}
            </Text>
          ) : null}
          {resendCooldownMessage ? (
            <Text style={[styles.unverifiedStatus, { color: colors.textSecondary }]}>
              {resendCooldownMessage}
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

  return (
    <>
      {cardContent}
      <EmailVerificationDialog
        visible={verificationVisible}
        email={verificationEmail || ''}
        onClose={handleCloseVerificationDialog}
        onResend={handleResendVerification}
        resendDisabled={resendDisabled}
        resendLabel={resendButtonLabel}
        statusMessage={resendStatusMessage}
        cooldownMessage={resendCooldownMessage}
        isResending={resendStatus === 'sending'}
        verified={verificationSuccess}
      />
      <StandardBottomSheet
        visible={authErrorSheet.visible}
        onClose={closeAuthErrorSheet}
        title={t(authErrorSheet.titleKey)}
        subtitle={authErrorSheet.messageKey ? t(authErrorSheet.messageKey) : undefined}
        actions={{
          primaryLabel: t('common.ok'),
          onPrimary: closeAuthErrorSheet,
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  cardCompact: {
    padding: ThemeLayout.spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: ThemeLayout.spacing.md,
    lineHeight: 20,
  },
  input: {
    borderRadius: ThemeLayout.borderRadius.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
    marginBottom: ThemeLayout.spacing.xs,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    width: '100%',
  },
  inputWithToggle: {
    position: 'relative',
    width: '100%',
    marginBottom: ThemeLayout.spacing.xs,
  },
  inputWithToggleField: {
    marginBottom: 0,
    paddingRight: ThemeLayout.spacing.xl + ThemeLayout.spacing.lg,
  },
  passwordToggle: {
    position: 'absolute',
    right: ThemeLayout.spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  passwordTogglePressed: {
    opacity: 0.7,
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
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  btnTextSecondary: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  btnTextCompact: {
    fontSize: 15,
  },
  hint: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  danger: {
    backgroundColor: '#f58c8c',
    marginTop: ThemeLayout.spacing.md,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: ThemeLayout.spacing.xs,
  },
  mockSection: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
  },
  mockSectionTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  mockSectionSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  mockButtonSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.xs,
  },
  unverifiedMessage: {
    fontSize: 14,
    marginBottom: ThemeLayout.spacing.sm,
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  unverifiedStatus: {
    marginTop: ThemeLayout.spacing.xs,
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});

export default EmailAuthCard;
