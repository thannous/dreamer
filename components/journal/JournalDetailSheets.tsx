import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
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
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { ReferenceImage, SubscriptionTier } from '@/lib/types';
import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * `BottomSheet` styles its content through a `style` prop, so the sheet shells stay
 * objects. Everything rendered inside them is Uniwind.
 */
const SHEET_BASE = {
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 20,
  paddingTop: 18,
  paddingBottom: 24,
  borderWidth: 1,
} as const;
const SHEET_STYLE = { ...SHEET_BASE, gap: 12 } as const;
const NOTICE_SHEET_STYLE = { ...SHEET_BASE, gap: 14 } as const;

const HANDLE_CLASS = 'mb-3 h-1 w-11 self-center rounded-full bg-line opacity-70';
const TITLE_CLASS = 'font-serif-bold text-[20px] text-ivory';
const BODY_CLASS = 'font-sans text-[15px] leading-[22px] text-ivory-muted';

const NOTICE_TONE_CLASS: Record<AnalysisNoticeTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
  info: 'bg-ink-soft',
};

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
          icon: noctalia.accent.text,
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
        NOTICE_SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
      testID={TID.Sheet.AnalysisNotice}
    >
      <View className={HANDLE_CLASS} />
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-[14px] ${NOTICE_TONE_CLASS[tone]}`}>
          <IconSymbol name={iconName} size={24} color={toneTokens.icon} />
        </View>
        <Text className={TITLE_CLASS}>
          {notice?.title}
        </Text>
      </View>
      <Text className={BODY_CLASS}>
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
        SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View className={HANDLE_CLASS} />
      <Text className={TITLE_CLASS}>
        {t('journal.detail.image_replace.title')}
      </Text>
      <Text className={BODY_CLASS}>
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
        SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View className={HANDLE_CLASS} />
      <Text className={TITLE_CLASS}>
        {t('journal.detail.reanalyze_prompt.title')}
      </Text>
      <Text className={BODY_CLASS}>
        {t('journal.detail.reanalyze_prompt.message')}
      </Text>
      <PressableScale
        onPress={() => {
          onImagePolicyChange(isRegenerate ? 'keep' : 'regenerate');
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isRegenerate }}
        accessibilityLabel={t('journal.detail.reanalyze_prompt.regenerate_label')}
        accessibilityHint={t('journal.detail.reanalyze_prompt.regenerate_note')}
        disabled={isLocked}
        className={`flex-row items-start gap-3 rounded-md border border-line bg-ink-active p-3 ${
          isLocked ? 'opacity-50' : ''
        }`}
      >
        <View
          className={`mt-px h-[22px] w-[22px] items-center justify-center rounded-[6px] border border-line ${
            isRegenerate ? 'bg-champagne' : 'bg-transparent'
          }`}
        >
          {isRegenerate ? (
            <IconSymbol name="checkmark" size={16} color={noctalia.action.primaryText} />
          ) : null}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-sans-bold text-[15px] leading-5 text-ivory">
            {t('journal.detail.reanalyze_prompt.regenerate_label')}
          </Text>
          <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted">
            {t('journal.detail.reanalyze_prompt.regenerate_note')}
          </Text>
        </View>
      </PressableScale>
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
        SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View className={HANDLE_CLASS} />
      <Text className={TITLE_CLASS}>
        {t('journal.detail.delete_confirm.title')}
      </Text>
      <Text className={BODY_CLASS}>
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
        SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
      testID={TID.Sheet.QuotaLimit}
    >
      <View className={HANDLE_CLASS} />
      <Text className={TITLE_CLASS} testID={TID.Text.QuotaLimitTitle}>
        {title}
      </Text>
      <Text className={BODY_CLASS}>
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
        NOTICE_SHEET_STYLE,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
        shadows.xl,
      ]}
    >
      <View className={HANDLE_CLASS} />
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-danger">
          <IconSymbol name="exclamationmark.circle.fill" size={24} color={noctalia.status.danger.icon} />
        </View>
        <Text className={TITLE_CLASS}>
          {t('image_retry.generation_failed')}
        </Text>
      </View>
      <Text className={BODY_CLASS}>
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
        active={visible}
        subjectType={subjectType}
        onImagesSelected={onImagesSelected}
        maxImages={REFERENCE_IMAGES.MAX_UPLOADS}
      />
    </StandardBottomSheet>
  );
}
