import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyIllustration } from '@/components/atmosphere/EmptyIllustration';
import { Screen } from '@/components/atmosphere/Screen';
import { StatTile } from '@/components/profile/StatTile';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { Button, Card, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { calendarDays, computeStats, computeStreak, toLocalDay } from '@/lib/streak';

export default function ProfileTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const { practiceLog, favorites } = useLibrary();

  // Read once per mount: `new Date()` in a render body is a moving dependency,
  // and the streak must not shift under the user while they read it.
  const [today] = useState(() => toLocalDay(new Date()));

  const streak = useMemo(() => computeStreak(practiceLog, today), [practiceLog, today]);
  const stats = useMemo(() => computeStats(practiceLog), [practiceLog]);
  const days = useMemo(() => calendarDays(practiceLog, today), [practiceLog, today]);

  const empty = practiceLog.length === 0;

  return (
    <Screen variant="subtle" edges={['top']}>
      <ScrollView
        testID={TID.Screen.Profile}
        contentContainerClassName="px-gutter pt-4 gap-6"
        contentContainerStyle={{ paddingBottom: tabBarInset }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('profile.title')}</Text>
          <Rule className="self-start" />
          {!empty ? (
            <Text variant="bodySm">
              {streak.practisedToday ? t('profile.today.done') : t('profile.today.pending')}
            </Text>
          ) : null}
        </View>

        {empty ? (
          <View className="items-center gap-3 py-8">
            <EmptyIllustration name="practice" />
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
          </View>
        ) : (
          <>
            <View className="flex-row gap-3">
              <StatTile
                testID={TID.Text.ProfileStreak}
                value={streak.current}
                label={t('profile.streak.current')}
                featured
              />
              <StatTile value={streak.longest} label={t('profile.streak.longest')} />
            </View>

            <View className="flex-row gap-3">
              <StatTile value={stats.totalSessions} label={t('profile.stats.sessions')} />
              <StatTile value={stats.totalMinutes} label={t('profile.stats.minutes')} />
            </View>

            <View className="gap-3">
              <Text variant="h2">{t('profile.calendar.title')}</Text>
              <Rule className="self-start" />
              <Card>
                <StreakCalendar days={days} />
              </Card>
            </View>
          </>
        )}

        <Card>
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
              label={t('profile.settings')}
              variant="ghost"
              onPress={() => router.push('/settings')}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
