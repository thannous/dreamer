import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { BottomSheetActions, BottomSheetPrimaryAction, BottomSheetSecondaryAction } from '@/components/ui/BottomSheetActions';
import { EmailVerificationIcon } from '@/components/icons/EmailVerificationIcon';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

export type EmailVerificationPendingDialogProps = {
  visible: boolean;
  email: string;
  onClose: () => void;
  resend: {
    label: string;
    onPress: () => void;
    state?: 'enabled' | 'disabled' | 'loading';
    testID?: string;
  };
  statusMessage?: string | null;
  cooldownMessage?: string | null;
};

export const EmailVerificationPendingDialog: React.FC<EmailVerificationPendingDialogProps> = ({
  visible,
  email,
  onClose,
  resend,
  statusMessage,
  cooldownMessage,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const title = t('settings.account.verification.title');

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
            verified={false}
            successColor="#16A34A"
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>

        {/* Subtitle with email highlighted */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <>
            {t('settings.account.verification.subtitle_prefix')}{' '}
            <Text style={[styles.emailHighlight, { color: colors.textPrimary }]}>
              {email}
            </Text>
          </>
        </Text>

        {/* Status badge - only show when not verified */}
        <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary }]}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
            {t('settings.account.verification.waiting_short')}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={resend.label}
          onPress={resend.onPress}
          state={resend.state}
          testID={resend.testID ?? TID.Button.AuthResendVerification}
        />
        <BottomSheetSecondaryAction
          label={t('common.done')}
          onPress={onClose}
          testID={TID.Button.AuthCloseVerification}
        />
      </BottomSheetActions>

      {/* Status messages */}
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

export type EmailVerificationSuccessDialogProps = {
  visible: boolean;
  onClose: () => void;
};

export const EmailVerificationSuccessDialog: React.FC<EmailVerificationSuccessDialogProps> = ({
  visible,
  onClose,
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
        <View style={styles.iconContainer}>
          <EmailVerificationIcon
            size={64}
            color={colors.accent}
            verified
            successColor="#16A34A"
          />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('settings.account.verification.success_title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.account.verification.success_subtitle')}
        </Text>
      </View>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={t('common.continue')}
          onPress={onClose}
          testID={TID.Button.AuthCloseVerification}
        />
      </BottomSheetActions>
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
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  emailHighlight: {
    fontFamily: Fonts.spaceGrotesk.bold,
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
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  status: {
    marginTop: ThemeLayout.spacing.sm,
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
  cooldown: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
});
