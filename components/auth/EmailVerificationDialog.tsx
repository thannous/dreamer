import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { BottomSheetActions } from '@/components/ui/BottomSheetActions';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type EmailVerificationDialogProps = {
  visible: boolean;
  email: string;
  onClose: () => void;
  onResend: () => void;
  resendDisabled: boolean;
  resendLabel: string;
  statusMessage?: string | null;
  cooldownMessage?: string | null;
  isResending?: boolean;
};

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  visible,
  email,
  onClose,
  onResend,
  resendDisabled,
  resendLabel,
  statusMessage,
  cooldownMessage,
  isResending = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={[styles.sheet, { backgroundColor: colors.backgroundCard }]}
      backdropColor="rgba(0,0,0,0.6)"
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary }]}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.badgeText, { color: colors.textPrimary }]}>
            {t('settings.account.verification.waiting', { seconds: 15 })}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('settings.account.verification.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.account.verification.subtitle', { email })}
        </Text>
        <View style={[styles.hintBox, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.hint, { color: colors.textPrimary }]}>
            {t('settings.account.verification.help')}
          </Text>
          <Text style={[styles.hintSub, { color: colors.textSecondary }]}>
            {t('settings.account.verification.auto_signin')}
          </Text>
        </View>
      </View>

      <BottomSheetActions
        primaryLabel={resendLabel}
        onPrimary={onResend}
        primaryDisabled={resendDisabled}
        primaryLoading={isResending}
        primaryTestID={TID.Button.AuthResendVerification}
        secondaryLabel={t('common.done')}
        onSecondary={onClose}
        secondaryTestID={TID.Button.AuthCloseVerification}
      />

      {statusMessage ? (
        <Text style={[styles.status, { color: colors.textSecondary }]} testID={TID.Text.AuthEmailVerificationStatus}>
          {statusMessage}
        </Text>
      ) : null}
      {cooldownMessage ? (
        <Text style={[styles.cooldown, { color: colors.textSecondary }]}>{cooldownMessage}</Text>
      ) : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.md,
  },
  header: {
    gap: ThemeLayout.spacing.sm,
    marginBottom: ThemeLayout.spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: ThemeLayout.spacing.xs,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  title: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
  },
  hintBox: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.sm,
    gap: 4,
  },
  hint: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    lineHeight: 20,
  },
  hintSub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 18,
  },
  status: {
    marginTop: ThemeLayout.spacing.sm,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  cooldown: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});

export default EmailVerificationDialog;
