import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { QUOTAS } from '@/constants/limits';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';

type ReferenceSubjectType = 'person' | 'animal' | null;

export function FirstDreamSheet({
  visible,
  onDismiss,
  onAnalyze,
  onJournal,
  isPersisting,
}: {
  visible: boolean;
  onDismiss: () => void;
  onAnalyze: () => void;
  onJournal: () => void;
  isPersisting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={t('guest.first_dream.sheet.title')}
      subtitle={t('guest.first_dream.sheet.subtitle')}
      titleTestID={TID.Text.FirstDreamSheetTitle}
      actions={{
        primaryLabel: t('guest.first_dream.sheet.analyze'),
        onPrimary: onAnalyze,
        primaryDisabled: isPersisting,
        primaryLoading: isPersisting,
        primaryTestID: TID.Button.FirstDreamAnalyze,
        secondaryLabel: t('guest.first_dream.sheet.journal'),
        onSecondary: onJournal,
        secondaryDisabled: isPersisting,
        secondaryTestID: TID.Button.FirstDreamJournal,
        linkLabel: t('guest.first_dream.sheet.dismiss'),
        onLink: onDismiss,
        linkTestID: TID.Button.FirstDreamDismiss,
      }}
    />
  );
}

export function AnalyzePromptSheet({
  visible,
  onDismiss,
  onAnalyze,
  onJournal,
  transcript,
  isPersisting,
}: {
  visible: boolean;
  onDismiss: () => void;
  onAnalyze: () => void;
  onJournal: () => void;
  transcript?: string | null;
  isPersisting: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={t('recording.analyze_prompt.sheet.title')}
      titleTestID={TID.Text.AnalyzePromptTitle}
      actions={{
        primaryLabel: t('recording.analyze_prompt.sheet.analyze'),
        onPrimary: onAnalyze,
        primaryDisabled: isPersisting,
        primaryLoading: isPersisting,
        primaryTestID: TID.Button.AnalyzePromptAnalyze,
        secondaryLabel: t('recording.analyze_prompt.sheet.journal'),
        onSecondary: onJournal,
        secondaryDisabled: isPersisting,
        secondaryTestID: TID.Button.AnalyzePromptJournal,
        linkLabel: t('recording.analyze_prompt.sheet.dismiss'),
        onLink: onDismiss,
      }}
    >
      {transcript ? (
        <View style={styles.sheetTranscriptContainer}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.sheetTranscriptScroll}
          >
            <Text style={[styles.sheetTranscriptText, { color: colors.textPrimary }]}>
              {transcript}
            </Text>
          </ScrollView>
        </View>
      ) : null}
    </StandardBottomSheet>
  );
}

export function GuestLimitSheet({
  visible,
  onClose,
  onCta,
}: {
  visible: boolean;
  onClose: () => void;
  onCta: () => void;
}) {
  const { t } = useTranslation();

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('recording.guest_limit_sheet.title')}
      subtitle={t('recording.guest_limit_sheet.message')}
      actions={{
        primaryLabel: t('recording.guest_limit_sheet.cta'),
        onPrimary: onCta,
        primaryTestID: TID.Button.GuestLimitCta,
      }}
    />
  );
}

export function QuotaLimitSheet({
  visible,
  onClose,
  onPrimary,
  onSecondary,
  onLink,
  mode,
  tier,
  usageLimit,
  message,
}: {
  visible: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
  onLink?: () => void;
  mode: 'limit' | 'error' | 'login';
  tier: SubscriptionTier;
  usageLimit?: number | null;
  message?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

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
        secondaryLabel: mode === 'limit' ? t('recording.analysis_limit.journal') : undefined,
        onSecondary: mode === 'limit' ? onSecondary : undefined,
        secondaryTestID: mode === 'limit' ? TID.Button.QuotaLimitJournal : undefined,
        linkLabel: mode === 'limit' ? t('recording.analysis_limit.dismiss') : undefined,
        onLink: mode === 'limit' ? onLink : undefined,
      }}
    >
      {mode === 'limit' && tier === 'free' && (
        <View style={styles.quotaFeaturesList}>
          <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
            ✓ {t('recording.analysis_limit.feature_analyses')}
          </Text>
          <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
            ✓ {t('recording.analysis_limit.feature_explorations')}
          </Text>
          <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
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
        subjectType={subjectType}
        onImagesSelected={onImagesSelected}
        maxImages={REFERENCE_IMAGES.MAX_UPLOADS}
      />
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
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
