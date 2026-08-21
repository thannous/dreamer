import React from 'react';
import { View } from 'react-native';

import { Button, IconSymbol, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import type { MeditationWorld } from '@/constants/worlds';
import type { MeditationSession, SessionProgress } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

type Props = {
  session: MeditationSession;
  progress?: SessionProgress;
  world: MeditationWorld;
  onOpen: (resume: boolean) => void;
};

/**
 * The only glass-like support shelf on the immersive home. It carries one
 * choice, not a carousel: enter today's ritual or continue it where it stopped.
 */
export function DailyRitualShelf({ session, progress, world, onOpen }: Props) {
  const { t } = useTranslation();
  const colors = Themes[world.appearance];
  const ratio = progress ? progress.positionSec / session.durationSec : 0;
  const canResume = ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
  const progressPercent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const title = t(`session.${session.id}.title` as TranslationKey);
  const meta = `${t('home.journey.minutes', { count: toMinutes(session.durationSec) })} · ${t(
    `category.${session.categorySlug}.name` as TranslationKey
  )}`;

  return (
    <View className="overflow-hidden rounded-artwork border border-hairline bg-ink-card px-5 py-5">
      <View className="gap-1">
        <Text variant="overline">{t('home.journey.sessionLabel')}</Text>
        <Text variant="h1" numberOfLines={2}>
          {title}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <IconSymbol name="clock" size={15} color={colors.textSecondary} />
          <Text variant="bodySm">{meta}</Text>
          {session.isPremium ? <Text variant="overline">{t('common.plus')}</Text> : null}
        </View>
      </View>

      {canResume ? (
        <View
          className="mt-4 gap-2"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={title}
          accessibilityValue={{ min: 0, max: 100, now: progressPercent }}>
          <View className="h-1 overflow-hidden rounded-full bg-ink-panel">
            <View
              className="h-full rounded-full bg-champagne"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>
      ) : null}

      <Button
        className="mt-5"
        label={t(canResume ? 'home.journey.continue' : 'home.journey.begin')}
        accessibilityLabel={`${t(
          canResume ? 'home.journey.continue' : 'home.journey.begin'
        )}. ${title}. ${meta}`}
        onPress={() => onOpen(canResume)}
      />
    </View>
  );
}
