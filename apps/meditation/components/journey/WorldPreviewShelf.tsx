import React from 'react';
import { View } from 'react-native';

import { ACTIVE_JOURNEY_CTA_TEST_ID } from '@/components/journey/WorldJourneyPicker';
import { Button, Text } from '@/components/ui';
import type { MeditationWorld } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';

type Props = {
  world: MeditationWorld;
  priceLabel: string;
  onPreview: () => void;
};

const PREVIEW_BENEFITS = [1, 2, 3] as const;

/** Purchase support stays outside the radio card, so TalkBack sees two peers. */
export function WorldPreviewShelf({ world, priceLabel, onPreview }: Props) {
  const { t } = useTranslation();
  const role = t(`world.${world.id}.role` as TranslationKey);
  const ritual = t(`world.${world.id}.ritual` as TranslationKey);

  return (
    <View className="gap-4 overflow-hidden rounded-artwork border border-hairline bg-ink-card px-5 py-5">
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="overline">{role}</Text>
          <Text variant="caption" tone="muted">
            {t(`world.${world.id}.moment` as TranslationKey)}
          </Text>
        </View>
        <Text variant="bodySm">{ritual}</Text>
        <Text variant="caption" tone="muted">
          {t('world.purchase.oneTime')} · {priceLabel}
        </Text>
        <Text variant="caption" tone="muted">
          {t('world.purchase.notPlus')}
        </Text>
      </View>
      <View className="gap-2">
        {PREVIEW_BENEFITS.map((index) => (
          <View key={index} className="flex-row items-start gap-3">
            <View className="mt-[7px] h-[3px] w-3 rounded-full bg-champagne" />
            <Text variant="caption" className="flex-1">
              {t(`world.purchase.benefit.${index}` as TranslationKey)}
            </Text>
          </View>
        ))}
      </View>
      <Button
        testID={ACTIVE_JOURNEY_CTA_TEST_ID}
        label={t('home.journey.previewWorld')}
        accessibilityLabel={`${t('home.journey.previewWorld')}. ${t(world.nameKey)}. ${role}. ${t(
          'world.purchase.oneTime'
        )}. ${priceLabel}. ${t('world.purchase.notPlus')}`}
        onPress={onPreview}
      />
    </View>
  );
}
