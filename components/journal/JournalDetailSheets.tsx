import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  BottomSheetActions,
  BottomSheetLinkAction,
  BottomSheetPrimaryAction,
  BottomSheetSecondaryAction,
} from '@/components/ui/BottomSheetActions';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { QUOTAS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';
import { IconSymbol } from '@/components/ui/icon-symbol';

type ReferenceSubjectType = 'person' | 'animal' | null;

type QuotaMode = 'quota' | 'login';

type AnalysisNoticeTone = 'success' | 'warning' | 'error' | 'info';

export type AnalysisNotice = {
  title: string;
  message: string;
  tone?: AnalysisNoticeTone;
};

export function AnalysisNoticeSheet({
  visible,
  onClose,
  notice,
}: {
  visible: boolean;
  onClose: () => void;
  notice?: AnalysisNotice | null;
}) {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  const tone = notice?.tone ?? 'info';
  const toneTokens = tone === 'success'
    ? noctalia.status.success
    : tone === 'warning'
      ? noctalia.status.warning
      : tone === 'error'
        ? noctalia.status.danger
        : {
          background: noctalia.surface.soft,
          border: noctalia.surface.border,
          text: noctalia.text.primary,
          icon: noctalia.accent.base,
        };
  const iconName = tone === 'success'
    ? 'checkmark.circle.fill'
    : tone === 'warning'
      ? 'exclamationmark.triangle.fill'
      : tone === 'error'
        ? 'xmark.circle.fill'
        : 'info.circle';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.noticeSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
      testID={TID.Sheet.AnalysisNotice}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <View style={styles.noticeHeader}>
        <View style={[styles.noticeIcon, { backgroundColor: toneTokens.background }]}>
          <IconSymbol name={iconName} size={24} color={toneTokens.icon} />
        </View>
        <Text style={[styles.sheetTitle, { color: noctalia.text.primary }]}>
          {notice?.title}
        </Text>
      </View>
      <Text style={[styles.noticeMessage, { color: noctalia.text.secondary }]}>
        {notice?.message}
      </Text>
      <BottomSheetActions>
        <BottomSheetPrimaryAction label={t('common.ok')} onPress={onClose} />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function ReplaceImageSheet({
  visible,
  onClose,
  onReplace,
  onKeep,
  isLocked,
}: {
  visible: boolean;
  onClose: () => void;
  onReplace: () => void;
  onKeep: () => void;
  isLocked: boolean;
}) {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.replaceImageSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <Text style={[styles.sheetTitle, { color: noctalia.text.primary }]}>
        {t('journal.detail.image_replace.title')}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: noctalia.text.secondary }]}>
        {t('journal.detail.image_replace.subtitle')}
      </Text>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={t('journal.detail.image_replace.replace')}
          onPress={onReplace}
          state={isLocked ? 'disabled' : 'enabled'}
        />
        <BottomSheetSecondaryAction
          label={t('journal.detail.image_replace.keep')}
          onPress={onKeep}
          state={isLocked ? 'disabled' : 'enabled'}
        />
        <BottomSheetLinkAction label={t('common.cancel')} onPress={onClose} />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function ReanalyzeSheet({
  visible,
  onClose,
  onConfirm,
  isLocked,
  imagePolicy,
  onImagePolicyChange,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLocked: boolean;
  imagePolicy: 'keep' | 'regenerate';
  onImagePolicyChange: (next: 'keep' | 'regenerate') => void;
}) {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const isRegenerate = imagePolicy === 'regenerate';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.replaceImageSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <Text style={[styles.sheetTitle, { color: noctalia.text.primary }]}>
        {t('journal.detail.reanalyze_prompt.title')}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: noctalia.text.secondary }]}>
        {t('journal.detail.reanalyze_prompt.message')}
      </Text>
      <Pressable
        onPress={() => {
          onImagePolicyChange(isRegenerate ? 'keep' : 'regenerate');
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isRegenerate }}
        accessibilityLabel={t('journal.detail.reanalyze_prompt.regenerate_label')}
        accessibilityHint={t('journal.detail.reanalyze_prompt.regenerate_note')}
        disabled={isLocked}
        style={[
          styles.sheetCheckboxRow,
          { borderColor: noctalia.surface.border, backgroundColor: noctalia.surface.active },
          isLocked && { opacity: 0.5 },
        ]}
      >
        <View
          style={[
            styles.sheetCheckboxBox,
            {
              borderColor: noctalia.surface.border,
          backgroundColor: isRegenerate ? noctalia.action.primary : 'transparent',
            },
          ]}
        >
          {isRegenerate ? (
            <IconSymbol name="checkmark" size={16} color={noctalia.action.primaryText} />
          ) : null}
        </View>
        <View style={styles.sheetCheckboxContent}>
          <Text style={[styles.sheetCheckboxLabel, { color: noctalia.text.primary }]}>
            {t('journal.detail.reanalyze_prompt.regenerate_label')}
          </Text>
          <Text style={[styles.sheetCheckboxNote, { color: noctalia.text.secondary }]}>
            {t('journal.detail.reanalyze_prompt.regenerate_note')}
          </Text>
        </View>
      </Pressable>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={t('journal.detail.reanalyze_prompt.reanalyze')}
          onPress={onConfirm}
          state={isLocked ? 'disabled' : 'enabled'}
        />
        <BottomSheetSecondaryAction
          label={t('journal.detail.reanalyze_prompt.later')}
          onPress={onClose}
          state={isLocked ? 'disabled' : 'enabled'}
        />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function DeleteConfirmSheet({
  visible,
  onClose,
  onConfirm,
  isDeleting,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.deleteSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <Text style={[styles.sheetTitle, { color: noctalia.text.primary }]}>
        {t('journal.detail.delete_confirm.title')}
      </Text>
      <Text style={[styles.deleteSheetMessage, { color: noctalia.text.secondary }]}>
        {t('journal.detail.delete_confirm.message')}
      </Text>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={t('journal.detail.delete_confirm.confirm')}
          onPress={onConfirm}
          state={isDeleting ? 'loading' : 'enabled'}
          variant="danger"
        />
        <BottomSheetSecondaryAction
          label={t('common.cancel')}
          onPress={onClose}
          state={isDeleting ? 'disabled' : 'enabled'}
        />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function QuotaLimitSheet({
  visible,
  onClose,
  onPrimary,
  onSecondary,
  onLink,
  tier,
  mode,
  usageLimit,
}: {
  visible: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  onLink: () => void;
  tier: SubscriptionTier;
  mode: QuotaMode;
  usageLimit?: number | null;
}) {
  const { colors, mode: themeMode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, themeMode), [colors, themeMode]);
  const { t } = useTranslation();

  const resolvedLimit = typeof usageLimit === 'number'
    ? usageLimit
    : tier === 'guest'
      ? QUOTAS.guest.analysis ?? 0
      : QUOTAS.free.analysis ?? 0;

  const title = tier === 'guest' && mode === 'login'
    ? t('journal.detail.quota_limit.title_login')
    : tier === 'guest'
      ? t('journal.detail.quota_limit.title_guest')
      : t('journal.detail.quota_limit.title_free');

  const subtitle = tier === 'guest' && mode === 'login'
    ? t('journal.detail.quota_limit.message_login')
    : tier === 'guest'
      ? t('journal.detail.quota_limit.message_guest', { limit: resolvedLimit })
      : t('journal.detail.quota_limit.message_free', { limit: resolvedLimit });

  const primaryLabel = tier === 'guest' && mode === 'login'
    ? t('journal.detail.quota_limit.cta_login')
    : tier === 'guest'
      ? t('journal.detail.quota_limit.cta_guest')
      : t('journal.detail.quota_limit.cta_free');

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.quotaLimitSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
      testID={TID.Sheet.QuotaLimit}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <Text
        style={[styles.sheetTitle, { color: noctalia.text.primary }]}
        testID={TID.Text.QuotaLimitTitle}
      >
        {title}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: noctalia.text.secondary }]}>
        {subtitle}
      </Text>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={primaryLabel}
          onPress={onPrimary}
          testID={tier === 'guest' ? TID.Button.QuotaLimitCtaGuest : TID.Button.QuotaLimitCtaFree}
        />
        <BottomSheetSecondaryAction
          label={t('journal.detail.quota_limit.journal')}
          onPress={onSecondary}
          testID={TID.Button.QuotaLimitJournal}
        />
        <BottomSheetLinkAction
          label={t('journal.detail.quota_limit.dismiss')}
          onPress={onLink}
        />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function ImageErrorSheet({
  visible,
  onClose,
  onRetry,
  isRetrying,
  message,
}: {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  message?: string | null;
}) {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={noctalia.surface.overlay}
      style={[
        styles.noticeSheet,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.border }]} />
      <View style={styles.noticeHeader}>
        <View
          style={[
            styles.noticeIcon,
            { backgroundColor: noctalia.status.danger.background },
          ]}
        >
          <IconSymbol name="exclamationmark.circle.fill" size={24} color={noctalia.status.danger.icon} />
        </View>
        <Text style={[styles.sheetTitle, { color: noctalia.text.primary }]}>
          {t('image_retry.generation_failed')}
        </Text>
      </View>
      <Text style={[styles.noticeMessage, { color: noctalia.text.secondary }]}>
        {message ?? t('common.unknown_error')}
      </Text>
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={t('analysis.retry')}
          onPress={onRetry}
          state={isRetrying ? 'loading' : 'enabled'}
        />
        <BottomSheetSecondaryAction label={t('common.cancel')} onPress={onClose} />
      </BottomSheetActions>
    </BottomSheet>
  );
}

export function ReferenceImageSheet({
  visible,
  subjectType,
  referenceImages,
  isGenerating,
  onClose,
  onPrimary,
  onSecondary,
  onImagesSelected,
}: {
  visible: boolean;
  subjectType: ReferenceSubjectType;
  referenceImages: ReferenceImage[];
  isGenerating: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  onImagesSelected: (images: ReferenceImage[]) => void;
}) {
  const { t } = useTranslation();

  if (!subjectType) {
    return null;
  }

  const primaryLabel = referenceImages.length >= REFERENCE_IMAGES.MAX_UPLOADS
    ? t('reference_image.confirm')
    : t('subject_proposition.accept');

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={subjectType === 'person'
        ? t('reference_image.title_person')
        : t('reference_image.title_animal')}
      actions={{
        primaryLabel,
        onPrimary,
        primaryDisabled: referenceImages.length === 0 || isGenerating,
        primaryLoading: isGenerating,
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
  deleteSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  deleteSheetMessage: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 22,
  },
  replaceImageSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  noticeSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderWidth: 1,
    gap: 14,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeMessage: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 22,
  },
  quotaLimitSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.7,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: Fonts.lora.bold,
  },
  sheetSubtitle: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 22,
  },
  sheetCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetCheckboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  sheetCheckboxContent: {
    flex: 1,
    gap: 2,
  },
  sheetCheckboxLabel: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    lineHeight: 20,
  },
  sheetCheckboxNote: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 18,
  },
});
