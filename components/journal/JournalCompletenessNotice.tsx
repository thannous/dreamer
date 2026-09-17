import React from 'react';
import { Text, View } from 'react-native';
import { PressableScale } from '@/components/motion';
import { useTranslation } from '@/hooks/useTranslation';

export function JournalCompletenessNotice({ status, onRetry, trends = false }: {
  status?: 'local' | 'loading' | 'complete' | 'incomplete';
  onRetry: () => void;
  trends?: boolean;
}) {
  const { t } = useTranslation();
  if (status !== 'loading' && status !== 'incomplete') return null;
  return (
    <View className="gap-3 rounded-2xl border border-line bg-ink-soft p-4" accessibilityLiveRegion="polite">
      <Text className="font-sans text-body-sm text-ivory-muted">
        {t(trends ? 'journal.completeness.trends' : `journal.completeness.${status}`)}
      </Text>
      {status === 'incomplete' ? (
        <PressableScale onPress={onRetry} accessibilityRole="button" className="min-h-[44px] justify-center self-start px-3">
          <Text className="font-sans-bold text-body-sm text-champagne-on">{t('journal.persistence.retry')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
