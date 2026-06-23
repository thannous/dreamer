import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { resendVerificationEmail } from '@/lib/auth';
import { TID } from '@/lib/testIDs';

type Props = {
  isCompact?: boolean;
};

const EmailVerificationBanner: React.FC<Props> = ({ isCompact = false }) => {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const isVerified = Boolean(user?.email_confirmed_at);

  const statusMessage = useMemo(() => {
    if (status === 'success') {
      return t('settings.account.banner.unverified.success');
    }
    if (status === 'error') {
      return t('settings.account.banner.unverified.error');
    }
    return null;
  }, [status, t]);

  const statusColor = status === 'error' ? noctalia.status.danger.text : noctalia.text.secondary;

  const handleResend = useCallback(async () => {
    if (!user?.email || status === 'sending') {
      return;
    }
    setStatus('sending');
    try {
      await resendVerificationEmail(user.email);
      setStatus('success');
    } catch (error) {
      if (__DEV__) {
        console.warn('[EmailVerificationBanner] resend failed', error);
      }
      setStatus('error');
    }
  }, [status, user?.email]);

  if (!user || isVerified) {
    return null;
  }

  return (
    <View
      testID={TID.Component.EmailVerificationBanner}
      style={[
        styles.banner,
        isCompact && styles.bannerCompact,
        { backgroundColor: noctalia.surface.active, borderColor: noctalia.surface.border },
      ]}
    >
      <Text style={[styles.title, { color: noctalia.text.primary }]}>
        {t('settings.account.banner.unverified.title')}
      </Text>
      <Text style={[styles.message, { color: noctalia.text.secondary }]}>
        {t('settings.account.banner.unverified.message')}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.action,
          pressed && styles.actionPressed,
          status === 'sending' && styles.actionDisabled,
          {
            borderColor: noctalia.action.primaryBorder,
            backgroundColor: noctalia.surface.raised,
          },
        ]}
        onPress={handleResend}
        disabled={status === 'sending'}
        testID={TID.Button.AuthResendVerification}
      >
        {status === 'sending' ? (
          <ActivityIndicator color={noctalia.text.primary} />
        ) : (
          <Text style={[styles.actionText, { color: noctalia.text.primary }]}>
            {t('settings.account.banner.unverified.action')}
          </Text>
        )}
      </Pressable>
      {statusMessage ? (
        <Text
          style={[styles.statusMessage, { color: statusColor }]}
          testID={TID.Text.AuthEmailVerificationStatus}
        >
          {statusMessage}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  bannerCompact: {
    padding: ThemeLayout.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.xs,
  },
  message: {
    fontSize: 14,
    marginBottom: ThemeLayout.spacing.sm,
  },
  action: {
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
    paddingVertical: ThemeLayout.spacing.xs,
    paddingHorizontal: ThemeLayout.spacing.sm,
    alignSelf: 'flex-start',
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  statusMessage: {
    marginTop: ThemeLayout.spacing.xs,
    fontSize: 12,
  },
});

export default EmailVerificationBanner;
