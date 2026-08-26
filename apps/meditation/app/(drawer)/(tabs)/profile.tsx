import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyIllustration } from '@/components/atmosphere/EmptyIllustration';
import { StatTile } from '@/components/profile/StatTile';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { ArtworkGlassPanel, Button, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { Atmosphere, Themes } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { calendarDays, computeStats, computeStreak, toLocalDay } from '@/lib/streak';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { useWorld } from '@/context/WorldContext';

export default function ProfileTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const { practiceLog, favorites } = useLibrary();
  const compact = useCompactLayout();
  const { world } = useWorld();
  const worldColors = Themes[world.appearance];

  // Read once per mount: `new Date()` in a render body is a moving dependency,
  // and the streak must not shift under the user while they read it.
  const [today] = useState(() => toLocalDay(new Date()));

  const streak = useMemo(() => computeStreak(practiceLog, today), [practiceLog, today]);
  const stats = useMemo(() => computeStats(practiceLog), [practiceLog]);
  const days = useMemo(() => calendarDays(practiceLog, today), [practiceLog, today]);

  const empty = practiceLog.length === 0;

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
        <View className="gap-3">
          <Text variant={compact ? 'h2' : 'h1'}>{t('profile.title')}</Text>
          <Rule className="self-start" />
          {!empty ? (
            <Text variant="bodySm">
              {streak.practisedToday ? t('profile.today.done') : t('profile.today.pending')}
            </Text>
          ) : null}
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
            <Button
              label={t('profile.empty.cta')}
              variant="secondary"
              className="mt-4"
              onPress={() => router.push('/search')}
            />
          </ArtworkGlassPanel>
        ) : (
          <>
            <View className={`flex-row ${compact ? 'gap-2' : 'gap-3'}`}>
              <StatTile
                testID={TID.Text.ProfileStreak}
                value={streak.current}
                label={t('profile.streak.current')}
                featured
                compact={compact}
                appearance={world.appearance}
              />
              <StatTile
                value={streak.longest}
                label={t('profile.streak.longest')}
                compact={compact}
                appearance={world.appearance}
              />
            </View>

            <View className={`flex-row ${compact ? 'gap-2' : 'gap-3'}`}>
              <StatTile
                value={stats.totalSessions}
                label={t('profile.stats.sessions')}
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

        <ArtworkGlassPanel
          appearance={world.appearance}
          contentStyle={styles.panelContent}
          testID="profile.actions-glass">
          <View className="gap-3">
            <Button
              label={
                favorites.length > 0
                  ? `${t('profile.favorites')} · ${favorites.length}`
                  : t('profile.favorites')
              }
              variant="secondary"
              onPress={() => router.push('/favorites')}
            />
            <Button
              testID={TID.Button.ProfileSettings}
              label={t('profile.settings')}
              variant="ghost"
              onPress={() => router.push('/settings')}
            />
          </View>
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
