import { PressableScale } from '@/components/motion';
import type { DreamPersistenceState, DreamRefreshState } from '@/hooks/useDreamPersistence';
import { useTranslation } from '@/hooks/useTranslation';
import React from 'react';
import { Text, View } from 'react-native';

type JournalPersistenceNoticeProps = {
  state: DreamPersistenceState;
  onRetry: () => void;
  refreshState?: DreamRefreshState;
  onRefresh?: () => void;
};

export function JournalPersistenceNotice({
  state,
  onRetry,
  refreshState,
  onRefresh,
}: JournalPersistenceNoticeProps) {
  const { t } = useTranslation();
  const refreshFailed = state.status !== 'error' && refreshState?.status === 'error';
  if (state.status !== 'error' && !refreshFailed) return null;

  const titleKey = refreshFailed ? 'journal.persistence.refresh_title'
    : state.status === 'error' && state.operation === 'read'
    ? 'journal.persistence.read_title'
    : 'journal.persistence.write_title';
  const messageKey = refreshFailed ? 'journal.persistence.refresh_message'
    : state.status === 'error' && state.operation === 'read'
    ? state.target === 'device'
      ? 'journal.persistence.read_device'
      : 'journal.persistence.read_cache'
    : state.target === 'device'
      ? 'journal.persistence.write_device'
      : 'journal.persistence.write_cache';

  return (
    <View
      className="gap-3 rounded-2xl border border-continuous border-line bg-ink-soft px-4 py-4"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View className="gap-1">
        <Text className="font-sans-bold text-body text-ivory">{t(titleKey)}</Text>
        <Text className="font-sans text-body-sm text-ivory-muted">{t(messageKey)}</Text>
      </View>
      <PressableScale
        className="min-h-[44px] self-start justify-center rounded-full border border-continuous border-champagne-soft px-5 py-2"
        accessibilityRole="button"
        accessibilityLabel={t('journal.persistence.retry')}
        onPress={refreshFailed ? onRefresh : onRetry}
      >
        <Text className="font-sans-bold text-[15px] text-champagne-on">
          {t('journal.persistence.retry')}
        </Text>
      </PressableScale>
    </View>
  );
}
