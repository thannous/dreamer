import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkGlassPanel, Text } from '@/components/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Themes, type ThemeMode } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import type { MeditationSession, SessionId } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MILESTONE_KEYS = [
  'home.journey.tomorrow',
  'home.journey.next',
  'home.journey.later',
] as const satisfies readonly TranslationKey[];

type Props = {
  sessions: readonly MeditationSession[];
  appearance: ThemeMode;
  isSessionIncluded?: (sessionId: SessionId) => boolean;
  onOpen: (sessionId: SessionId) => void;
  testID?: string;
};

function UpcomingCard({
  session,
  appearance,
  milestoneKey,
  width,
  isSessionIncluded,
  onOpen,
  testID,
}: {
  session: MeditationSession;
  appearance: ThemeMode;
  milestoneKey: TranslationKey;
  width: number;
  isSessionIncluded?: (sessionId: SessionId) => boolean;
  onOpen: (sessionId: SessionId) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const title = t(`session.${session.id}.title` as TranslationKey);
  const minutes = t('home.journey.minutes', { count: toMinutes(session.durationSec) });
  const category = t(`category.${session.categorySlug}.name` as TranslationKey);
  const milestone = t(milestoneKey);
  const showsPlus = session.isPremium && !isSessionIncluded?.(session.id);
  const meta = showsPlus
    ? `${minutes} · ${category} · ${t('common.plus')}`
    : `${minutes} · ${category}`;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${milestone}. ${title}. ${meta}`}
      accessibilityHint={t('home.journey.openUpcoming')}
      onPress={() => onOpen(session.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { width }]}
      className="rounded-xl"
      testID={testID}>
        <ArtworkGlassPanel
          appearance={appearance}
          contentStyle={styles.cardContent}
          testID={`home.journey.upcoming-glass.${session.id}`}>
          <Text variant="overline">{milestone}</Text>
          <Text variant="h3" numberOfLines={2} className="mt-2">
            {title}
          </Text>
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <IconSymbol name="clock" size={14} color={Themes[appearance].textSecondary} />
            <Text variant="caption" tone="muted">
              {minutes}
            </Text>
            <Text variant="caption" tone="accent">
              {category}
            </Text>
            {showsPlus ? <Text variant="overline">{t('common.plus')}</Text> : null}
          </View>
        </ArtworkGlassPanel>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    padding: 16,
  },
});

/**
 * Manual peek-carousel of later daily recommendations. Native horizontal
 * scroll is the motion; nothing auto-advances, and a swipe never haptics.
 */
export function UpcomingJourneyRail({
  sessions,
  appearance,
  isSessionIncluded,
  onOpen,
  testID = 'home.journey.up-next',
}: Props) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const cardWidth = trackWidth > 0 ? Math.round(trackWidth * 0.78) : 248;

  if (sessions.length === 0) return null;

  return (
    <View className="gap-3" testID={testID} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      <Text variant="overline">{t('home.journey.upNext')}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerClassName="gap-3 pr-8">
        {sessions.slice(0, 3).map((session, index) => (
          <UpcomingCard
            key={session.id}
            session={session}
            appearance={appearance}
            milestoneKey={MILESTONE_KEYS[Math.min(index, MILESTONE_KEYS.length - 1)]}
            width={cardWidth}
            isSessionIncluded={isSessionIncluded}
            onOpen={onOpen}
            testID={`home.journey.upcoming.${session.id}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}
