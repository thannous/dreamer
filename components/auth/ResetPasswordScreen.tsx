import React, { useEffect, useMemo, useState } from 'react';
import { isAuthApiError } from '@supabase/auth-js';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { EyeIcon, EyeOffIcon } from '@/components/icons/DreamIcons';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isLucidTrainer } from '@/lib/appVariant';
import { onPasswordRecovery, updatePassword } from '@/lib/auth';
import { PASSWORD_MIN_LENGTH } from '@/lib/authValidation';
import { TID } from '@/lib/testIDs';

type Phase = 'checking' | 'ready' | 'success' | 'expired';

const CONTINUE_DESTINATION = isLucidTrainer ? '/lucid' : '/recording';
const SIGN_IN_DESTINATION = isLucidTrainer ? '/lucid/account' : '/(tabs)/settings';

const getUpdateErrorKey = (error: unknown): string => {
  if (isAuthApiError(error) && error.code === 'same_password') {
    return 'auth.reset_password.same_password';
  }
  return 'auth.reset_password.error';
};

/**
 * Landing screen for the password-recovery email link.
 *
 * On web, supabase-js consumes the recovery tokens from the URL fragment when the
 * client initialises and emits `PASSWORD_RECOVERY`; the resulting session also
 * surfaces through `useAuth()`. Either signal unlocks the form. When neither
 * arrives (expired or already-used link) the screen offers a way back to sign-in.
 */
const ResetPasswordScreen: React.FC = () => {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [recoveryDetected, setRecoveryDetected] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onPasswordRecovery((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'))
      ) {
        setRecoveryDetected(true);
      }
    });
    return unsubscribe;
  }, []);

  const hasSession = recoveryDetected || Boolean(user);
  const phase: Phase = completed
    ? 'success'
    : hasSession
      ? 'ready'
      : authLoading
        ? 'checking'
        : 'expired';

  const passwordValid = password.length >= PASSWORD_MIN_LENGTH;
  const passwordsMatch = password === confirmPassword;
  const showPasswordError = touched.password && password.length > 0 && !passwordValid;
  const showMismatchError = touched.confirm && confirmPassword.length > 0 && !passwordsMatch;
  const submitDisabled = submitting || !passwordValid || !passwordsMatch;

  const handleSubmit = async () => {
    setTouched({ password: true, confirm: true });
    if (submitDisabled) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      setCompleted(true);
    } catch (error) {
      if (__DEV__) {
        console.warn('[ResetPasswordScreen] updatePassword failed', error);
      }
      setErrorKey(getUpdateErrorKey(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    router.replace(CONTINUE_DESTINATION);
  };

  const handleBackToSignIn = () => {
    router.replace(SIGN_IN_DESTINATION);
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: noctalia.surface.active,
      borderColor: noctalia.surface.border,
      color: noctalia.text.primary,
    },
  ];
  const passwordToggleLabel = passwordVisible ? t('auth.password.hide') : t('auth.password.show');
  const passwordToggleColor = passwordVisible ? noctalia.text.primary : noctalia.text.secondary;

  const renderPrimaryButton = (label: string, onPress: () => void, options?: { disabled?: boolean; loading?: boolean; testID?: string }) => {
    const disabled = options?.disabled ?? false;
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: disabled ? noctalia.action.disabled : noctalia.action.primary,
            borderColor: disabled ? noctalia.action.disabledBorder : noctalia.action.primaryBorder,
          },
          pressed && !disabled && styles.buttonPressed,
        ]}
        testID={options?.testID}
      >
        {options?.loading ? (
          <ActivityIndicator color={noctalia.action.primaryText} />
        ) : (
          <Text
            style={[
              styles.primaryButtonText,
              { color: disabled ? noctalia.action.disabledText : noctalia.action.primaryText },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderSecondaryButton = (label: string, onPress: () => void, testID?: string) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { backgroundColor: noctalia.surface.active, borderColor: noctalia.surface.border },
        pressed && styles.buttonPressed,
      ]}
      testID={testID}
    >
      <Text style={[styles.secondaryButtonText, { color: noctalia.text.primary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  let content: React.ReactNode;
  if (phase === 'checking') {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator color={noctalia.accent.text} />
        <Text style={[styles.subtitle, styles.centeredText, { color: noctalia.text.secondary }]}>
          {t('auth.reset_password.checking')}
        </Text>
      </View>
    );
  } else if (phase === 'expired') {
    content = (
      <>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {t('auth.reset_password.expired_title')}
        </Text>
        <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
          {t('auth.reset_password.expired_message')}
        </Text>
        {renderPrimaryButton(t('auth.reset_password.back_to_signin'), handleBackToSignIn, {
          testID: TID.Button.AuthResetBackToSignIn,
        })}
      </>
    );
  } else if (phase === 'success') {
    content = (
      <>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {t('auth.reset_password.success_title')}
        </Text>
        <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
          {t('auth.reset_password.success_message')}
        </Text>
        {renderPrimaryButton(t('auth.reset_password.continue'), handleContinue, {
          testID: TID.Button.AuthResetContinue,
        })}
      </>
    );
  } else {
    content = (
      <>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {t('auth.reset_password.title')}
        </Text>
        <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
          {t('auth.reset_password.subtitle')}
        </Text>

        <View style={styles.inputWithToggle}>
          <TextInput
            testID={TID.Input.AuthNewPassword}
            style={[inputStyle, styles.inputWithToggleField]}
            placeholder={t('auth.reset_password.new_password')}
            placeholderTextColor={noctalia.text.secondary}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (!touched.password) {
                setTouched((prev) => ({ ...prev, password: true }));
              }
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
          <Pressable
            testID={TID.Button.AuthTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={passwordToggleLabel}
            hitSlop={8}
            onPress={() => setPasswordVisible((prev) => !prev)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.buttonPressed]}
          >
            {passwordVisible ? (
              <EyeIcon size={18} color={passwordToggleColor} />
            ) : (
              <EyeOffIcon size={18} color={passwordToggleColor} slashColor={noctalia.surface.active} />
            )}
          </Pressable>
        </View>
        {showPasswordError ? (
          <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
            {t('auth.password.too_short', { count: PASSWORD_MIN_LENGTH })}
          </Text>
        ) : null}

        <TextInput
          testID={TID.Input.AuthConfirmPassword}
          style={inputStyle}
          placeholder={t('auth.reset_password.confirm_password')}
          placeholderTextColor={noctalia.text.secondary}
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            if (!touched.confirm) {
              setTouched((prev) => ({ ...prev, confirm: true }));
            }
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
          secureTextEntry={!passwordVisible}
          textContentType="newPassword"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          onSubmitEditing={handleSubmit}
        />
        {showMismatchError ? (
          <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
            {t('auth.reset_password.mismatch')}
          </Text>
        ) : null}

        {errorKey ? (
          <Text
            style={[styles.errorText, styles.submitError, { color: noctalia.status.danger.text }]}
            testID={TID.Text.AuthResetPasswordError}
          >
            {t(errorKey)}
          </Text>
        ) : null}

        {renderPrimaryButton(t('auth.reset_password.submit'), handleSubmit, {
          disabled: submitDisabled,
          loading: submitting,
          testID: TID.Button.AuthUpdatePassword,
        })}
        {renderSecondaryButton(
          t('auth.reset_password.back_to_signin'),
          handleBackToSignIn,
          TID.Button.AuthResetBackToSignIn
        )}
      </>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: noctalia.screen.background }]}
      testID={TID.Screen.ResetPassword}
    >
      <AtmosphericBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + ThemeLayout.spacing.xl,
            paddingBottom: insets.bottom + ThemeLayout.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
          ]}
        >
          {content}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  card: {
    alignSelf: 'center',
    borderRadius: ThemeLayout.borderRadius.xl,
    borderWidth: 1,
    maxWidth: 440,
    padding: ThemeLayout.spacing.lg,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
    paddingVertical: ThemeLayout.spacing.md,
  },
  centeredText: {
    marginBottom: 0,
    textAlign: 'center',
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: ThemeLayout.spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: ThemeLayout.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    width: '100%',
  },
  inputWithToggle: {
    position: 'relative',
    width: '100%',
    marginBottom: 10,
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
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: ThemeLayout.spacing.xs,
  },
  submitError: {
    fontSize: 13,
    marginTop: ThemeLayout.spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: ThemeLayout.spacing.sm,
    minHeight: 48,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: ThemeLayout.spacing.sm,
    minHeight: 48,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});

export default ResetPasswordScreen;
