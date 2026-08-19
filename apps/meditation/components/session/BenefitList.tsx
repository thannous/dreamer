import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import type { MeditationSession } from '@/lib/types';

/** Three benefits, each on its own line behind a champagne tick. */
export function BenefitList({ session }: { session: MeditationSession }) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      {Array.from({ length: session.benefitCount }, (_, index) => (
        <View key={index} className="flex-row items-start gap-3">
          <View className="mt-[9px] h-[3px] w-3 rounded-full bg-champagne" />
          <Text variant="body" tone="muted" className="flex-1">
            {t(`session.${session.id}.benefit.${index + 1}` as TranslationKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}
