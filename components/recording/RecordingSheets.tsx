import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { QUOTAS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';

type ReferenceSubjectType = 'person' | 'animal' | null;

export function MicPermissionRationaleSheet({
  visible,
  onClose,
  onAllow,
  onUseText,
}: {
  visible: boolean;
  onClose: () => void;
  onAllow: () => void;
  onUseText: () => void;
}) {
  const { t } = useTranslation();

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('recording.mic_rationale.title')}
      subtitle={t('recording.mic_rationale.message')}
      testID={TID.Sheet.MicRationale}
      actions={{
        primaryLabel: t('recording.mic_rationale.allow'),
        onPrimary: onAllow,
        primaryTestID: TID.Button.MicRationaleAllow,
        secondaryLabel: t('recording.mic_rationale.text_fallback'),
        onSecondary: onUseText,
        secondaryTestID: TID.Button.MicRationaleUseText,
        linkLabel: t('recording.mic_rationale.dismiss'),
        onLink: onClose,
        linkTestID: TID.Button.MicRationaleDismiss,
      }}
    />
  );
}

export function QuotaLimitSheet({
  visible,
  onClose,
  onPrimary,
  onSecondary,
  onReset,
  onLink,
  mode,
  tier,
  usageLimit,
  message,
  resetDisabled = false,
}: {
  visible: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
  onReset?: () => void;
  onLink?: () => void;
  mode: 'limit' | 'error' | 'login';
  tier: SubscriptionTier;
  usageLimit?: number | null;
  message?: string;
  resetDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode: themeMode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, themeMode), [colors, themeMode]);

  const resolvedLimit = typeof usageLimit === 'number'
    ? usageLimit
    : tier === 'guest'
      ? QUOTAS.guest.analysis ?? 0
      : QUOTAS.free.analysis ?? 0;

  const title = mode === 'login'
    ? t('recording.analysis_limit.title_login')
    : mode === 'limit'
      ? tier === 'guest'
        ? t('recording.analysis_limit.title_guest')
        : t('recording.analysis_limit.title_free')
      : t('common.error_title');

  const subtitle = mode === 'login'
    ? t('recording.analysis_limit.message_login')
    : mode === 'limit'
      ? tier === 'guest'
        ? t('recording.analysis_limit.message_guest', { limit: resolvedLimit })
        : t('recording.analysis_limit.message_free', { limit: resolvedLimit })
      : message ?? '';

  const assurance = mode === 'limit'
    ? tier === 'guest'
      ? t('recording.analysis_limit.assurance_guest', { limit: resolvedLimit })
      : t('recording.analysis_limit.assurance_free')
    : null;

  const primaryLabel = mode === 'login'
    ? t('recording.analysis_limit.cta_login')
    : mode === 'limit'
      ? tier === 'guest'
        ? t('recording.analysis_limit.cta_guest')
        : t('recording.analysis_limit.cta_free')
      : t('common.ok');

  const primaryTestID = mode === 'limit'
    ? tier === 'guest'
      ? TID.Button.QuotaLimitCtaGuest
      : TID.Button.QuotaLimitCtaFree
    : mode === 'login'
      ? TID.Button.QuotaLimitCtaGuest
      : TID.Button.QuotaLimitCtaFree;
  const resetAvailable = mode === 'limit' && Boolean(onReset);

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      testID={TID.Sheet.QuotaLimit}
      titleTestID={TID.Text.QuotaLimitTitle}
      actions={{
        primaryLabel,
        onPrimary,
        primaryTestID,
        secondaryLabel: resetAvailable
          ? t('settings.account.mock.reset')
          : mode === 'limit'
            ? t('recording.analysis_limit.journal')
            : undefined,
        onSecondary: resetAvailable ? onReset : mode === 'limit' ? onSecondary : undefined,
        secondaryDisabled: resetAvailable ? resetDisabled : false,
        secondaryTestID: resetAvailable
          ? TID.Button.QuotaLimitResetMock
          : mode === 'limit'
            ? TID.Button.QuotaLimitJournal
            : undefined,
        linkLabel: mode === 'limit' ? t('recording.analysis_limit.dismiss') : undefined,
        onLink: mode === 'limit' ? onLink : undefined,
      }}
    >
      {assurance ? (
        <View
          style={[
            styles.quotaAssurance,
            {
              backgroundColor: noctalia.surface.soft,
              borderColor: noctalia.surface.border,
            },
          ]}
        >
          <Text style={[styles.quotaAssuranceText, { color: noctalia.text.secondary }]}>
            {assurance}
          </Text>
        </View>
      ) : null}
      {mode === 'limit' && tier === 'free' && (
        <View style={styles.quotaFeaturesList}>
          <Text style={[styles.quotaFeature, { color: noctalia.text.primary }]}>
            ✓ {t('recording.analysis_limit.feature_analyses')}
          </Text>
          <Text style={[styles.quotaFeature, { color: noctalia.text.primary }]}>
            ✓ {t('recording.analysis_limit.feature_explorations')}
          </Text>
          <Text style={[styles.quotaFeature, { color: noctalia.text.primary }]}>
            ✓ {t('recording.analysis_limit.feature_priority')}
          </Text>
        </View>
      )}
    </StandardBottomSheet>
  );
}

export function ReferenceImageSheet({
  visible,
  subjectType,
  referenceImages,
  isPersisting,
  onClose,
  onPrimary,
  onSecondary,
  onImagesSelected,
}: {
  visible: boolean;
  subjectType: ReferenceSubjectType;
  referenceImages: ReferenceImage[];
  isPersisting: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  onImagesSelected: (images: ReferenceImage[]) => void;
}) {
  const { t } = useTranslation();

  if (!subjectType) {
    return null;
  }

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={subjectType === 'person'
        ? t('reference_image.title_person')
        : t('reference_image.title_animal')}
      actions={{
        primaryLabel: t('subject_proposition.accept'),
        onPrimary,
        primaryDisabled: referenceImages.length === 0 || isPersisting,
        primaryLoading: isPersisting,
        secondaryLabel: t('subject_proposition.skip'),
        onSecondary,
      }}
    >
      <ReferenceImagePicker
        active={visible}
        subjectType={subjectType}
        onImagesSelected={onImagesSelected}
        maxImages={REFERENCE_IMAGES.MAX_UPLOADS}
      />
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  analysisOfferError: {
    width: '100%',
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  analysisOfferErrorText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sheetTranscriptContainer: {
    width: '100%',
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 0,
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    maxHeight: 180,
    marginTop: ThemeLayout.spacing.sm,
  },
  sheetTranscriptScroll: {
    maxHeight: 164,
  },
  sheetTranscriptText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  quotaAssurance: {
    width: '100%',
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 1,
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  quotaAssuranceText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  quotaFeaturesList: {
    marginTop: ThemeLayout.spacing.sm,
    marginBottom: ThemeLayout.spacing.md,
    gap: 8,
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  quotaFeature: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
});
