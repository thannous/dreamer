import React from 'react';
import { Text, View } from 'react-native';

import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

import { WaitingStars } from './WaitingStars';

/**
 * Act II while the analysis runs: stars take turns lighting up, which says "working"
 * without inventing a percentage the service does not report. The copy carries the
 * state for screen readers and under reduce motion, where the stars hold still.
 */
export function DreamReadingWait() {
  const { t } = useTranslation();

  return (
    <View testID={TID.Component.DreamReadingWait} className="items-center gap-3 rounded-lg bg-ink-soft px-5 py-6">
      <WaitingStars />
      <Text accessibilityLiveRegion="polite" className="text-center font-display-medium text-[18px] leading-6 text-ivory">
        {t('journal.detail.reading.wait.title')}
      </Text>
      <Text className="text-center font-sans text-[14px] leading-5 text-ivory-muted">
        {t('journal.detail.reading.wait.body')}
      </Text>
    </View>
  );
}
