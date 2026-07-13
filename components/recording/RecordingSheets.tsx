import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';
import { RecordingActivationInsightCard } from '@/components/recording/RecordingActivationInsightCard';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { QUOTAS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { RecordingActivationInsight } from '@/lib/recordingActivationInsight';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';

type ReferenceSubjectType = 'person' | 'animal' | null;

export type AnalysisOfferQuotaState = 'known' | 'unlimited' | 'exhausted' | 'unknown';
export type AnalysisOfferPrimaryAction = 'launch' | 'login' | 'upgrade' | 'retry';

export function PostSaveOfferSheet({
  visible,
  kind,
  quotaState,
  remaining,
  primaryAction,
  isPersisting,
  activationInsight,
  onDismiss,
  onPrimary,
  onJournal,
}: {
  visible: boolean;
  kind: 'analysis' | 'memory';
  quotaState: AnalysisOfferQuotaState;
  remaining?: number | null;
  primaryAction: AnalysisOfferPrimaryAction;
  isPersisting: boolean;
  activationInsight?: RecordingActivationInsight | null;
  onDismiss: () => void;
  onPrimary: () => void;
  onJournal: () => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isAnalysisError = kind === 'analysis' && primaryAction === 'retry';

  const analysisSubtitle = primaryAction === 'retry'
    ? t('recording.analysis_offer.error')
    : quotaState === 'unlimited'
      ? t('recording.analysis_offer.unlimited')
      : quotaState === 'known' && typeof remaining === 'number'
        ? t('recording.analysis_offer.quota_remaining', { remaining })
        : quotaState === 'exhausted'
          ? t('recording.analysis_offer.exhausted')
          : t('recording.analysis_offer.unknown');
  const analysisPrimaryLabel = primaryAction === 'retry'
    ? t('recording.analysis_offer.retry')
    : primaryAction === 'login'
      ? t('recording.analysis_limit.cta_login')
      : primaryAction === 'upgrade'
        ? t('recording.analysis_limit.cta_free')
        : t('recording.analysis_offer.launch');

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={t(kind === 'memory' ? 'recording.memory_offer.title' : 'recording.analysis_offer.title')}
      subtitle={kind === 'memory'
        ? t('recording.memory_offer.subtitle')
        : isAnalysisError
          ? undefined
          : analysisSubtitle}
      testID={TID.Sheet.AnalysisOffer}
      titleTestID={TID.Text.AnalyzePromptTitle}
      actions={{
        primaryLabel: kind === 'memory'
          ? t('recording.memory_offer.view')
          : analysisPrimaryLabel,
        onPrimary: kind === 'memory' ? onJournal : onPrimary,
        primaryDisabled: isPersisting,
        primaryLoading: isPersisting,
        primaryTestID: TID.Button.AnalysisOfferPrimary,
        secondaryLabel: kind === 'memory'
          ? t('recording.memory_offer.analyze')
          : t('recording.analysis_offer.view'),
        onSecondary: kind === 'memory' ? onPrimary : onJournal,
        secondaryDisabled: isPersisting,
        secondaryTestID: TID.Button.AnalysisOfferJournal,
        linkLabel: t(kind === 'memory' ? 'recording.memory_offer.later' : 'recording.analysis_offer.later'),
        onLink: onDismiss,
        linkTestID: TID.Button.AnalysisOfferLater,
      }}
    >
      {isAnalysisError ? (
        <View
          accessibilityLiveRegion="assertive"
          style={[
            styles.analysisOfferError,
            {
              backgroundColor: noctalia.status.danger.background,
              borderColor: noctalia.status.danger.border,
            },
          ]}
        >
          <Text style={[styles.analysisOfferErrorText, { color: noctalia.status.danger.text }]}>
            {analysisSubtitle}
          </Text>
        </View>
      ) : null}
      <RecordingActivationInsightCard insight={activationInsight} />
    </StandardBottomSheet>
  );
}

export function FirstDreamSheet({
  visible,
  onDismiss,
  onAnalyze,
  onJournal,
  isPersisting,
  activationInsight,
  isRememberedDream = false,
}: {
  visible: boolean;
  onDismiss: () => void;
  onAnalyze: () => void;
  onJournal: () => void;
  isPersisting: boolean;
  activationInsight?: RecordingActivationInsight | null;
  isRememberedDream?: boolean;
}) {
  const { t } = useTranslation();
  const usesRememberedCopy = isRememberedDream || activationInsight?.tone === 'memory';

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={
        usesRememberedCopy
          ? t('guest.first_dream.sheet.remembered_title')
          : t('guest.first_dream.sheet.title')
      }
      subtitle={
        usesRememberedCopy
          ? t('guest.first_dream.sheet.remembered_subtitle')
          : t('guest.first_dream.sheet.subtitle')
      }
      titleTestID={TID.Text.FirstDreamSheetTitle}
      actions={{
        primaryLabel: usesRememberedCopy
          ? t('guest.first_dream.sheet.remembered_primary')
          : t('guest.first_dream.sheet.analyze'),
        onPrimary: usesRememberedCopy ? onJournal : onAnalyze,
        primaryDisabled: isPersisting,
        primaryLoading: isPersisting,
        primaryTestID: usesRememberedCopy
          ? TID.Button.FirstDreamJournal
          : TID.Button.FirstDreamAnalyze,
        secondaryLabel: usesRememberedCopy
          ? t('guest.first_dream.sheet.remembered_analyze')
          : t('guest.first_dream.sheet.journal'),
        onSecondary: usesRememberedCopy ? onAnalyze : onJournal,
        secondaryDisabled: isPersisting,
        secondaryTestID: usesRememberedCopy
          ? TID.Button.FirstDreamAnalyze
          : TID.Button.FirstDreamJournal,
        linkLabel: t('guest.first_dream.sheet.dismiss'),
        onLink: onDismiss,
        linkTestID: TID.Button.FirstDreamDismiss,
      }}
    >
      <RecordingActivationInsightCard insight={activationInsight} />
    </StandardBottomSheet>
  );
}

export function AnalyzePromptSheet({
  visible,
  onDismiss,
  onAnalyze,
  onJournal,
  transcript,
  isPersisting,
  activationInsight,
  isRememberedDream = false,
}: {
  visible: boolean;
  onDismiss: () => void;
  onAnalyze: () => void;
  onJournal: () => void;
  transcript?: string | null;
  isPersisting: boolean;
  activationInsight?: RecordingActivationInsight | null;
  isRememberedDream?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode: themeMode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, themeMode), [colors, themeMode]);

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={
        isRememberedDream
          ? t('recording.remembered.default_title')
          : t('recording.analyze_prompt.sheet.title')
      }
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
      <RecordingActivationInsightCard insight={activationInsight} />
      {transcript ? (
        <View style={styles.sheetTranscriptContainer}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.sheetTranscriptScroll}
          >
            <Text style={[styles.sheetTranscriptText, { color: noctalia.text.primary }]}>
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
  const { colors, mode: themeMode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, themeMode), [colors, themeMode]);

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
        secondaryLabel: t('recording.guest_limit_sheet.back_to_text'),
        onSecondary: onClose,
        secondaryTestID: TID.Button.GuestLimitBackToText,
      }}
    >
      <View
        style={[
          styles.guestLimitAssurance,
          {
            backgroundColor: noctalia.surface.soft,
            borderColor: noctalia.surface.border,
          },
        ]}
      >
        <Text style={[styles.guestLimitAssuranceTitle, { color: noctalia.text.primary }]}>
          {t('recording.guest_limit_sheet.draft_title')}
        </Text>
        <Text style={[styles.guestLimitAssuranceText, { color: noctalia.text.secondary }]}>
          {t('recording.guest_limit_sheet.draft_message')}
        </Text>
      </View>
    </StandardBottomSheet>
  );
}

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
  guestLimitAssurance: {
    width: '100%',
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 1,
    padding: ThemeLayout.spacing.md,
    gap: 6,
    marginBottom: ThemeLayout.spacing.md,
  },
  guestLimitAssuranceTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  guestLimitAssuranceText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 19,
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
