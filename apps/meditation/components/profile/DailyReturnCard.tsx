import React from 'react';
import { View } from 'react-native';

import { ArtworkGlassPanel, Button, Text } from '@/components/ui';
import type { ThemeMode } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import type { DailyReturnOffer } from '@/lib/streak';

type Props = {
  offer: DailyReturnOffer | null;
  practisedToday: boolean;
  locked: boolean;
  compact?: boolean;
  appearance: ThemeMode;
  onPress: () => void;
};

/**
 * The first useful action on Profile: a familiar session, or a quiet path
 * into the catalogue. Never a scoreboard, never a missed-day reprimand.
 */
export function DailyReturnCard({
  offer,
  practisedToday,
  locked,
  compact = false,
  appearance,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const title = practisedToday ? t('profile.today.done') : t('profile.return.title');
  const subtitle = offer
    ? t(offer.kind === 'recent' ? 'profile.return.recent' : 'profile.return.saved', {
        session: t(`session.${offer.session.id}.title` as TranslationKey),
        count: toMinutes(offer.session.durationSec),
      })
    : practisedToday
      ? t('profile.return.rest')
      : t('profile.return.catalogue');
  const cta = offer
    ? t(offer.kind === 'recent' ? 'profile.return.cta.recent' : 'profile.return.cta.saved')
    : t('profile.empty.cta');

  return (
    <ArtworkGlassPanel
      appearance={appearance}
      contentStyle={{ gap: compact ? 10 : 12, padding: compact ? 16 : 20 }}
      testID="profile.return-glass">
      <View className="gap-2">
        <Text variant="overline">{t('profile.return.eyebrow')}</Text>
        <Text variant={compact ? 'h3' : 'h2'} testID="profile.return.title">
          {title}
        </Text>
        <Text variant="bodySm" testID="profile.return.subtitle">
          {subtitle}
        </Text>
        {locked ? (
          <Text variant="caption" testID="profile.return.locked">
            {t('session.saved.locked')}
          </Text>
        ) : null}
      </View>
      <Button
        testID="profile.return.cta"
        label={cta}
        variant="primary"
        size={compact ? 'md' : 'lg'}
        onPress={onPress}
      />
    </ArtworkGlassPanel>
  );
}
