import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { BottomSheetActions } from '@/components/ui/BottomSheetActions';
import { EmailVerificationIcon } from '@/components/icons/EmailVerificationIcon';
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
  verified?: boolean;
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
  verified = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const title = verified
    ? t('settings.account.verification.success_title')
    : t('settings.account.verification.title');

  const subtitle = verified
    ? t('settings.account.verification.success_subtitle')
    : t('settings.account.verification.subtitle', { email });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={[styles.sheet, { backgroundColor: colors.backgroundCard }]}
      backdropColor="rgba(0,0,0,0.6)"
    >
      <View style={styles.header}>
        {/* Hero icon */}
        <View style={styles.iconContainer}>
          <EmailVerificationIcon
            size={64}
            color={colors.accent}
            verified={verified}
            successColor="#16A34A"
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>

        {/* Subtitle with email highlighted */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {verified ? (
            subtitle
          ) : (
            <>
              {t('settings.account.verification.subtitle_prefix')}{' '}
              <Text style={[styles.emailHighlight, { color: colors.textPrimary }]}>
                {email}
              </Text>
            </>
          )}
        </Text>

        {/* Status badge - only show when not verified */}
        {!verified && (
          <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary }]}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {t('settings.account.verification.waiting_short')}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      {verified ? (
        <BottomSheetActions
          primaryLabel={t('common.continue')}
          onPrimary={onClose}
          primaryTestID={TID.Button.AuthCloseVerification}
        />
      ) : (
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
      )}

      {/* Status messages */}
      {statusMessage && !verified ? (
        <Text style={[styles.status, { color: colors.textSecondary }]} testID={TID.Text.AuthEmailVerificationStatus}>
          {statusMessage}
        </Text>
      ) : null}
      {cooldownMessage && !verified ? (
        <Text style={[styles.cooldown, { color: colors.textSecondary }]}>{cooldownMessage}</Text>
      ) : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingVertical: ThemeLayout.spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
    marginBottom: ThemeLayout.spacing.lg,
  },
  iconContainer: {
    marginBottom: ThemeLayout.spacing.sm,
  },
  title: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
    textAlign: 'center',
  },
  emailHighlight: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.xs,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.md,
    marginTop: ThemeLayout.spacing.sm,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  status: {
    marginTop: ThemeLayout.spacing.sm,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
  },
  cooldown: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
  },
});

export default EmailVerificationDialog;
