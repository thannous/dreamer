import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { SessionCard } from '@/components/session/SessionCard';
import { BackLink, Rule, Text } from '@/components/ui';
import { CATEGORY_BY_SLUG, isCategorySlug } from '@/content/categories';
import { sessionsInCategory } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import type { TranslationKey } from '@/lib/i18n';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();

  if (!slug || !isCategorySlug(slug)) {
    return (
      <Screen variant="subtle">
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="h3">{t('search.empty.title')}</Text>
        </View>
      </Screen>
    );
  }

  const category = CATEGORY_BY_SLUG[slug];
  const sessions = sessionsInCategory(slug);

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} fallbackHref="/search" className="px-gutter pb-2 pt-2" />

      <ScrollView
        contentContainerClassName="pb-10 gap-6"
        showsVerticalScrollIndicator={false}>
        <SessionArtwork
          accent={category.accent}
          rounded="artwork"
          className="mx-gutter min-h-40 justify-end">
          <View className="gap-1 p-gutter">
            <Text variant="h1">{t(`category.${slug}.name` as TranslationKey)}</Text>
            <Text variant="bodySm">{t(`category.${slug}.tagline` as TranslationKey)}</Text>
          </View>
        </SessionArtwork>

        <View className="gap-3 px-gutter">
          <Text variant="overline">{t('category.count', { count: sessions.length })}</Text>
          <Rule className="self-start" />
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              testID={
                session.id === 'dream-threshold' ? TID.Option.SessionDreamThreshold : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
