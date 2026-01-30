import React from 'react';
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
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';

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
  const { t } = useTranslation();

  const tone = notice?.tone ?? 'info';
  const toneColor = tone === 'success'
    ? '#22C55E'
    : tone === 'warning'
      ? '#F59E0B'
      : tone === 'error'
        ? '#EF4444'
        : colors.accent;
  const toneBackground = mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const iconName = tone === 'success'
    ? 'checkmark-circle'
    : tone === 'warning'
      ? 'alert-circle'
      : tone === 'error'
        ? 'close-circle'
        : 'information-circle';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
      style={[
        styles.noticeSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
      testID={TID.Sheet.AnalysisNotice}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <View style={styles.noticeHeader}>
        <View style={[styles.noticeIcon, { backgroundColor: toneBackground }]}>
          <Ionicons name={iconName} size={24} color={toneColor} />
        </View>
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
          {notice?.title}
        </Text>
      </View>
      <Text style={[styles.noticeMessage, { color: colors.textSecondary }]}>
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
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
      style={[
        styles.replaceImageSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
        {t('journal.detail.image_replace.title')}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
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
  const { t } = useTranslation();
  const isRegenerate = imagePolicy === 'regenerate';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
      style={[
        styles.replaceImageSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
        {t('journal.detail.reanalyze_prompt.title')}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
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
          { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
          isLocked && { opacity: 0.5 },
        ]}
      >
        <View
          style={[
            styles.sheetCheckboxBox,
            {
              borderColor: colors.divider,
              backgroundColor: isRegenerate ? colors.accent : 'transparent',
            },
          ]}
        >
          {isRegenerate ? (
            <Ionicons name="checkmark" size={16} color={colors.textOnAccentSurface} />
          ) : null}
        </View>
        <View style={styles.sheetCheckboxContent}>
          <Text style={[styles.sheetCheckboxLabel, { color: colors.textPrimary }]}>
            {t('journal.detail.reanalyze_prompt.regenerate_label')}
          </Text>
          <Text style={[styles.sheetCheckboxNote, { color: colors.textSecondary }]}>
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
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.35)'}
      style={[
        styles.deleteSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
        {t('journal.detail.delete_confirm.title')}
      </Text>
      <Text style={[styles.deleteSheetMessage, { color: colors.textSecondary }]}>
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
      backdropColor={themeMode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
      style={[
        styles.quotaLimitSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
      testID={TID.Sheet.QuotaLimit}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <Text
        style={[styles.sheetTitle, { color: colors.textPrimary }]}
        testID={TID.Text.QuotaLimitTitle}
      >
        {title}
      </Text>
      <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
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
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
      style={[
        styles.noticeSheet,
        { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
        shadows.xl,
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
      <View style={styles.noticeHeader}>
        <View
          style={[
            styles.noticeIcon,
            { backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
          ]}
        >
          <Ionicons name="alert-circle" size={24} color="#EF4444" />
        </View>
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
          {t('image_retry.generation_failed')}
        </Text>
      </View>
      <Text style={[styles.noticeMessage, { color: colors.textSecondary }]}>
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
