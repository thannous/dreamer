import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkGlassPanel, Text } from '@/components/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Themes, type ThemeMode } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useScreenReader } from '@/hooks/useScreenReader';
import type { TranslationKey } from '@/lib/i18n';
import type { Gate } from '@/lib/entitlements';
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
  accessForSession?: (session: MeditationSession) => Gate;
  onOpen: (sessionId: SessionId) => void;
  testID?: string;
  subscriptionsEnabled?: boolean;
};

function UpcomingCard({
  session,
  appearance,
  milestoneKey,
  width,
  isSessionIncluded,
  accessGate,
  onOpen,
  testID,
  subscriptionsEnabled = true,
}: {
  session: MeditationSession;
  appearance: ThemeMode;
  milestoneKey: TranslationKey;
  width?: number;
  isSessionIncluded?: (sessionId: SessionId) => boolean;
  accessGate?: Gate;
  onOpen: (sessionId: SessionId) => void;
  testID?: string;
  subscriptionsEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const title = t(`session.${session.id}.title` as TranslationKey);
  const minutes = t('home.journey.minutes', { count: toMinutes(session.durationSec) });
  const category = t(`category.${session.categorySlug}.name` as TranslationKey);
  const milestone = t(milestoneKey);
  const showsPlus =
    (subscriptionsEnabled ?? true) && session.isPremium && !isSessionIncluded?.(session.id);
  const accessLabel = showsPlus ? t('common.plus') : t('common.free');
  const quotaBlocked =
    (subscriptionsEnabled ?? true) &&
    accessGate?.allowed === false &&
    accessGate.reason === 'monthly-quota';
  const meta = quotaBlocked
    ? `${minutes} · ${category} · ${accessLabel} · ${t('paywall.remaining.none')}`
    : `${minutes} · ${category} · ${accessLabel}`;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${milestone}. ${title}. ${meta}`}
      accessibilityHint={t('home.journey.openUpcoming')}
      onPress={() => onOpen(session.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, width ? { width } : { alignSelf: 'stretch' }]}
      className="rounded-xl"
      testID={testID}>
        <ArtworkGlassPanel
          appearance={appearance}
          contentStyle={styles.cardContent}
          testID={`home.journey.upcoming-glass.${session.id}`}>
          <Text variant="overline">{milestone}</Text>
          <Text
            variant="h3"
            className="mt-2"
            testID={testID ? `${testID}.title` : undefined}>
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
            <Text variant="overline" testID={testID ? `${testID}.access` : undefined}>
              {accessLabel}
            </Text>
            {quotaBlocked ? (
              <Text variant="overline">{t('paywall.remaining.none')}</Text>
            ) : null}
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
 * scroll is the motion unless a screen reader is running; then the same
 * cards stack so TalkBack can leave the home scene for the tab bar.
 */
export function UpcomingJourneyRail({
  sessions,
  appearance,
  isSessionIncluded,
  accessForSession,
  onOpen,
  testID = 'home.journey.up-next',
  subscriptionsEnabled = true,
}: Props) {
  const { t } = useTranslation();
  const screenReader = useScreenReader();
  const [trackWidth, setTrackWidth] = useState(0);
  const cardWidth = trackWidth > 0 ? Math.round(trackWidth * 0.78) : 248;
  const visibleSessions = sessions.slice(0, 3);

  if (visibleSessions.length === 0) return null;

  const cards = visibleSessions.map((session, index) => (
    <UpcomingCard
      key={session.id}
      session={session}
      appearance={appearance}
      milestoneKey={MILESTONE_KEYS[Math.min(index, MILESTONE_KEYS.length - 1)]}
      width={screenReader ? undefined : cardWidth}
      isSessionIncluded={isSessionIncluded}
      accessGate={accessForSession?.(session)}
      onOpen={onOpen}
      testID={`home.journey.upcoming.${session.id}`}
      subscriptionsEnabled={subscriptionsEnabled}
    />
  ));

  return (
    <View className="gap-3" testID={testID} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      <Text variant="overline">{t('home.journey.upNext')}</Text>
      {screenReader ? (
        <View className="gap-3">{cards}</View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerClassName="gap-3 pr-8">
          {cards}
        </ScrollView>
      )}
    </View>
  );
}
