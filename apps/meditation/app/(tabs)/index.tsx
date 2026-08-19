import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SessionCard } from '@/components/session/SessionCard';
import { Button, Card, Rule, Text } from '@/components/ui';
import { sessionsInCategory, sessionsUpTo } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { greetingKey, resumableSession, sessionOfTheDay, toMinutes } from '@/lib/library';

/** How many short sessions the "if you only have a moment" row offers. */
const QUICK_COUNT = 4;

export default function HomeTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state } = useOnboarding();
  const { progress } = useLibrary();

  // Read once per mount rather than per render: `new Date()` in a render body
  // is a moving dependency, and the recommendation must not change under the
  // user between two glances at the same screen.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [hour] = useState(() => new Date().getHours());

  const todaySession = useMemo(() => sessionOfTheDay(today, state.goals), [today, state.goals]);

  const resume = useMemo(() => resumableSession(progress), [progress]);

  const quick = useMemo(
    () => sessionsUpTo(state.dailyIntentionMin ?? 10).slice(0, QUICK_COUNT),
    [state.dailyIntentionMin]
  );

  const tonight = useMemo(() => sessionsInCategory('sleep').slice(0, 3), []);

  return (
    <Screen variant="subtle" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-gutter pb-10 pt-4 gap-8"
        showsVerticalScrollIndicator={false}>
        <View className="gap-1">
          <Text variant="h1">{t(greetingKey(hour))}</Text>
          <Text variant="bodySm">{t('home.today.label')}</Text>
        </View>

        <SessionCard session={todaySession} variant="feature" />

        {resume ? (
          <View className="gap-3">
            <Text variant="h2">{t('home.resume.title')}</Text>
            <Rule className="self-start" />
            <SessionCard session={resume.session} />
            <Text variant="caption">
              {t('home.resume.left', { count: toMinutes(resume.remainingSec) })}
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Text variant="h2">{t('home.quick.title')}</Text>
          <Rule className="self-start" />
          {quick.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </View>

        <View className="gap-3">
          <Text variant="h2">{t('home.tonight.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('home.tonight.subtitle')}</Text>
          {tonight.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </View>

        <Card>
          <Text variant="h3">{t('home.breathe.title')}</Text>
          <Text variant="bodySm" className="mt-1">
            {t('home.breathe.subtitle')}
          </Text>
          <Button
            label={t('tabs.breathe')}
            variant="secondary"
            className="mt-4"
            onPress={() => router.push('/breathe')}
          />
        </Card>

        <Text variant="caption" className="text-center">
          {t('category.count', { count: 24 })} ·{' '}
          {t(`category.${todaySession.categorySlug}.tagline` as TranslationKey)}
        </Text>
      </ScrollView>
    </Screen>
  );
}
