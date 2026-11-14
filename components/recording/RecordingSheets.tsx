import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { ThemeLayout } from '@/constants/journalTheme';
import { QUOTAS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { SubscriptionTier } from '@/lib/types';

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

/**
 * iOS gives an app no way to open the Keyboard settings page, so the path is
 * written out as steps the reader follows in Settings.
 */
export function DictationOffSheet({
  visible,
  onClose,
  onUseText,
  onRetry,
}: {
  visible: boolean;
  onClose: () => void;
  onUseText: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('recording.dictation_off.title')}
      subtitle={t('recording.dictation_off.intro')}
      testID={TID.Sheet.DictationOff}
      actions={{
        primaryLabel: t('recording.dictation_off.use_text'),
        onPrimary: onUseText,
        primaryTestID: TID.Button.DictationOffUseText,
        secondaryLabel: t('recording.dictation_off.retry'),
        onSecondary: onRetry,
        secondaryTestID: TID.Button.DictationOffRetry,
        linkLabel: t('recording.dictation_off.dismiss'),
        onLink: onClose,
        linkTestID: TID.Button.DictationOffDismiss,
      }}
    >
      <DictationStepsCarousel />
    </StandardBottomSheet>
  );
}

type DictationStepSlide = {
  caption: string;
  /** The screen title drawn at the top of the thumbnail. */
  screen: string;
  /** The row to tap, drawn highlighted between faded rows. */
  row: string;
  toggle?: boolean;
};

/**
 * Drawn thumbnails of the three Settings screens (no real screenshots): they follow the
 * app language and stay true when Apple restyles Settings. One page per step.
 */
function DictationStepsCarousel() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const slides: DictationStepSlide[] = [
    {
      caption: t('recording.dictation_off.step_settings'),
      screen: t('recording.dictation_off.screen_settings'),
      row: t('recording.dictation_off.row_general'),
    },
    {
      caption: t('recording.dictation_off.step_keyboard'),
      screen: t('recording.dictation_off.row_general'),
      row: t('recording.dictation_off.row_keyboard'),
    },
    {
      caption: t('recording.dictation_off.step_toggle'),
      screen: t('recording.dictation_off.row_keyboard'),
      row: t('recording.dictation_off.row_dictation'),
      toggle: true,
    },
  ];
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setPageWidth(event.nativeEvent.layout.width);
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setPage((current) => (current === next ? current : next));
  }, [pageWidth]);
  const faded = { backgroundColor: noctalia.surface.border };

  return (
    <View style={styles.dictationCarousel} onLayout={onLayout} testID={TID.Component.DictationStepsCarousel}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {slides.map((slide, index) => (
          <View
            key={slide.caption}
            style={[styles.dictationSlide, pageWidth ? { width: pageWidth } : null]}
            accessible
            accessibilityLabel={`${index + 1}. ${slide.caption}`}
          >
            <View style={[styles.dictationThumb, { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border }]}>
              <Text style={[styles.dictationThumbTitle, { color: noctalia.text.primary }]}>{slide.screen}</Text>
              <View style={[styles.dictationFadedRow, faded]} />
              <View style={[styles.dictationRow, { borderColor: noctalia.accent.base }]}>
                <Text style={[styles.dictationRowText, { color: noctalia.text.primary }]} numberOfLines={1}>{slide.row}</Text>
                {slide.toggle ? (
                  <View style={[styles.dictationToggle, { backgroundColor: noctalia.accent.base }]}>
                    <View style={styles.dictationToggleKnob} />
                  </View>
                ) : (
                  <Text style={[styles.dictationChevron, { color: noctalia.text.secondary }]}>›</Text>
                )}
              </View>
              <View style={[styles.dictationFadedRow, faded]} />
            </View>
            <Text style={[styles.dictationStepText, { color: noctalia.text.primary }]}>
              {index + 1}. {slide.caption}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dictationDots}>
        {slides.map((slide, index) => (
          <View
            key={slide.caption}
            style={[
              styles.dictationDot,
              { backgroundColor: index === page ? noctalia.accent.base : noctalia.surface.border },
            ]}
          />
        ))}
      </View>
    </View>
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

const styles = StyleSheet.create({
  dictationCarousel: {
    width: '100%',
    marginBottom: ThemeLayout.spacing.md,
  },
  dictationSlide: {
    alignItems: 'center',
    paddingHorizontal: ThemeLayout.spacing.sm,
    gap: ThemeLayout.spacing.sm,
  },
  dictationThumb: {
    width: '100%',
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    padding: ThemeLayout.spacing.md,
    gap: 10,
  },
  dictationThumbTitle: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 16,
  },
  dictationFadedRow: {
    height: 12,
    borderRadius: 6,
    opacity: 0.7,
  },
  dictationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: ThemeLayout.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  dictationRowText: {
    flex: 1,
    fontFamily: Fonts.outfit.medium,
    fontSize: 15,
  },
  dictationChevron: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 20,
    lineHeight: 20,
  },
  dictationToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    alignItems: 'flex-end',
  },
  dictationToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  dictationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: ThemeLayout.spacing.sm,
  },
  dictationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dictationStepText: {
    textAlign: 'center',
    fontFamily: Fonts.outfit.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  analysisOfferError: {
    width: '100%',
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  analysisOfferErrorText: {
    fontFamily: Fonts.outfit.medium,
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
    fontFamily: Fonts.outfit.regular,
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
    fontFamily: Fonts.outfit.regular,
    fontSize: 14,
  },
});
