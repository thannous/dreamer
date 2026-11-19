import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyIllustration } from '@/components/atmosphere/EmptyIllustration';
import { DailyReturnCard } from '@/components/profile/DailyReturnCard';
import { StatTile } from '@/components/profile/StatTile';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ArtworkGlassPanel, Button, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { Atmosphere, Themes } from '@/constants/theme';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibraryMetadata } from '@/context/LibraryContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWorld } from '@/context/WorldContext';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { DrawerButtonClearance, useTabBarInset } from '@/hooks/useTabBarInset';
import {
  calendarDays,
  computeStats,
  computeStreak,
  computeWeekPractice,
  dailyReturnOffer,
  toLocalDay,
} from '@/lib/streak';
import { TID } from '@/lib/testIDs';

export default function ProfileTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const { practiceLog, favorites } = useLibraryMetadata();
  const { isPlus, subscriptionsEnabled = true } = useSubscription();
  const compact = useCompactLayout();
  const { world } = useWorld();
  const worldColors = Themes[world.appearance];

  // Read once per mount: `new Date()` in a render body is a moving dependency,
  // and the streak must not shift under the user while they read it.
  const [today] = useState(() => toLocalDay(new Date()));

  const streak = useMemo(() => computeStreak(practiceLog, today), [practiceLog, today]);
  const stats = useMemo(() => computeStats(practiceLog), [practiceLog]);
  const week = useMemo(() => computeWeekPractice(practiceLog, today), [practiceLog, today]);
  const days = useMemo(() => calendarDays(practiceLog, today), [practiceLog, today]);
  const offer = useMemo(
    () => dailyReturnOffer(practiceLog, favorites),
    [favorites, practiceLog]
  );

  const empty = practiceLog.length === 0;
  const plusRequired = subscriptionsEnabled && !isPlus;
  const lockedOffer = Boolean(offer?.session.isPremium && plusRequired);
  const lockedSavedCount = favorites.filter(
    (id) => SESSION_BY_ID[id]?.isPremium && plusRequired
  ).length;

  const openOffer = () => {
    if (offer) {
      router.push(`/session/${offer.session.id}`);
      return;
    }
    router.push('/search');
  };

  return (
    <WorldScene
      world={world}
      artwork="completion"
      edges={['top']}
      scrimStrength={1.08}>
      <ScrollView
        testID={TID.Screen.Profile}
        contentContainerClassName={compact ? 'gap-4 px-4 pt-3' : 'gap-6 px-gutter pt-4'}
        contentContainerStyle={{ paddingBottom: tabBarInset }}
        showsVerticalScrollIndicator={false}>
        <View testID="profile.title-row" className="gap-3" style={{ paddingRight: DrawerButtonClearance }}>
          <Text variant={compact ? 'h2' : 'h1'}>{t('profile.title')}</Text>
          <Rule className="self-start" />
        </View>

        {empty ? (
          <ArtworkGlassPanel
            appearance={world.appearance}
            contentStyle={styles.emptyState}
            testID="profile.empty-glass">
            <EmptyIllustration
              name="practice"
              lineColor={worldColors.accentText}
              dustColor={Atmosphere[world.appearance].star}
            />
            <Text variant="h3" className="text-center">
              {t('profile.empty.title')}
            </Text>
            <Text variant="bodySm" className="text-center">
              {t('profile.empty.subtitle')}
            </Text>
            {/* The one thing to do on an empty page, so the one filled button. */}
            <Button
              label={t('profile.empty.cta')}
              className="mt-4"
              onPress={() => router.push('/search')}
            />
          </ArtworkGlassPanel>
        ) : (
          <>
            <DailyReturnCard
              offer={offer}
              practisedToday={streak.practisedToday}
              locked={lockedOffer}
              compact={compact}
              appearance={world.appearance}
              onPress={openOffer}
            />

            <View className={`flex-row ${compact ? 'gap-2' : 'gap-3'}`}>
              <StatTile
                value={week.practisedDays}
                label={t('profile.week.days')}
                featured
                compact={compact}
                appearance={world.appearance}
              />
              <StatTile
                value={week.minutes}
                label={t('profile.week.minutes')}
                compact={compact}
                appearance={world.appearance}
              />
            </View>

            <View className={`flex-row ${compact ? 'gap-2' : 'gap-3'}`}>
              <StatTile
                testID={TID.Text.ProfileStreak}
                value={streak.current}
                label={t('profile.streak.current')}
                compact={compact}
                appearance={world.appearance}
              />
              <StatTile
                value={stats.totalMinutes}
                label={t('profile.stats.minutes')}
                compact={compact}
                appearance={world.appearance}
              />
            </View>

            {streak.longest > streak.current ? (
              <Text variant="caption" testID="profile.streak.history">
                {t('profile.streak.history', { count: streak.longest })}
              </Text>
            ) : null}

            <View className="gap-3">
              <Text variant="h2">{t('profile.calendar.title')}</Text>
              <Rule className="self-start" />
              <ArtworkGlassPanel
                appearance={world.appearance}
                contentStyle={styles.panelContent}
                testID="profile.calendar-glass">
                <StreakCalendar days={days} />
              </ArtworkGlassPanel>
            </View>
          </>
        )}

        {/* Three places to go, so three rows with a chevron — the same row as
            in Settings. As outlined buttons of equal weight they competed with
            the page's own action, and History opened the page before there
            was anything in it. */}
        <ArtworkGlassPanel appearance={world.appearance} testID="profile.actions-glass">
          <SettingsRow
            label={
              favorites.length > 0
                ? `${t('profile.favorites')} · ${favorites.length}`
                : t('profile.favorites')
            }
            onPress={() => router.push('/favorites')}
          />
          {lockedSavedCount > 0 ? (
            <Text variant="caption" className="px-gutter pt-3" testID="profile.favorites.locked">
              {t('profile.favorites.locked')}
            </Text>
          ) : null}
          <SettingsRow
            testID="btn.history.open"
            label={t('history.title')}
            onPress={() => router.push('/history')}
          />
          <SettingsRow
            testID={TID.Button.ProfileSettings}
            label={t('profile.settings')}
            onPress={() => router.push('/settings')}
          />
        </ArtworkGlassPanel>
      </ScrollView>
    </WorldScene>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  panelContent: {
    padding: 20,
  },
});
