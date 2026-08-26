import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ACTIVE_JOURNEY_CTA_TEST_ID } from '@/components/journey/WorldJourneyPicker';
import { WorldPathProgress } from '@/components/journey/WorldPathProgress';
import { ArtworkGlassPanel, Button, IconSymbol, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import type { MeditationWorld } from '@/constants/worlds';
import type { MeditationSession, SessionId, SessionProgress } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

type Props = {
  session: MeditationSession;
  sessionProgress?: SessionProgress;
  journeyProgress: Record<SessionId, SessionProgress>;
  world: MeditationWorld;
  isSessionIncluded?: (sessionId: SessionId) => boolean;
  onOpen: (resume: boolean) => void;
};

/**
 * The only glass-like support shelf on the immersive home. It carries one
 * choice, not a carousel: enter today's ritual or continue it where it stopped.
 */
export function DailyRitualShelf({
  session,
  sessionProgress,
  journeyProgress,
  world,
  isSessionIncluded,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const ratio = sessionProgress ? sessionProgress.positionSec / session.durationSec : 0;
  const canResume = ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
  const progressPercent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const title = t(`session.${session.id}.title` as TranslationKey);
  const meta = `${t('home.journey.minutes', { count: toMinutes(session.durationSec) })} · ${t(
    `category.${session.categorySlug}.name` as TranslationKey
  )}`;

  return (
      <ArtworkGlassPanel
        appearance={world.appearance}
        contentStyle={styles.content}
        testID="home.journey.ritual-glass">
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="overline">
              {t(`world.${world.id}.role` as TranslationKey)}
            </Text>
            <Text variant="caption" tone="muted">
              {t(`world.${world.id}.moment` as TranslationKey)}
            </Text>
          </View>
          <WorldPathProgress world={world} progress={journeyProgress} />
          <Text variant="h2" numberOfLines={2}>
            {title}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <IconSymbol name="clock" size={15} color={Themes[world.appearance].textSecondary} />
            <Text variant="bodySm">{meta}</Text>
            {session.isPremium && !isSessionIncluded?.(session.id) ? (
              <Text variant="overline">{t('common.plus')}</Text>
            ) : null}
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
          testID={ACTIVE_JOURNEY_CTA_TEST_ID}
          className="mt-5"
          label={t(canResume ? 'session.resume' : 'session.play')}
          accessibilityLabel={`${t(
            canResume ? 'home.journey.continue' : 'home.journey.begin'
          )}. ${title}. ${meta}`}
          onPress={() => onOpen(canResume)}
        />
      </ArtworkGlassPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});
