import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionArtwork } from '@/components/session/SessionArtwork';
import { SessionCard } from '@/components/session/SessionCard';
import { BackLink, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { getCategoryArtwork } from '@/constants/catalogArtwork';
import { Themes } from '@/constants/theme';
import { CATEGORY_BY_SLUG, isCategorySlug } from '@/content/categories';
import { sessionsInCategory } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useWorld } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import type { TranslationKey } from '@/lib/i18n';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { world } = useWorld();
  const worldColors = Themes[world.appearance];
  const insets = useSafeAreaInsets();

  if (!slug || !isCategorySlug(slug)) {
    return (
      <WorldScene world={world} artwork="journey" edges={['top']}>
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="h3">{t('search.empty.title')}</Text>
        </View>
      </WorldScene>
    );
  }

  const category = CATEGORY_BY_SLUG[slug];
  const sessions = sessionsInCategory(slug);

  return (
    <WorldScene world={world} artwork="journey" edges={['top']} scrimStrength={1.12}>
      <BackLink
        label={t('common.back')}
        fallbackHref="/search"
        iconColor={worldColors.accentText}
        className="px-gutter pb-2 pt-2"
      />

      <ScrollView
        contentContainerClassName="gap-6 px-0"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 32 }}
        showsVerticalScrollIndicator={false}>
        <SessionArtwork
          appearance={world.appearance}
          accent={category.accent}
          source={getCategoryArtwork(category.slug, world.appearance)}
          rounded="artwork"
          className="mx-gutter min-h-40 justify-end"
          testID="category.hero">
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
              appearance={world.appearance}
              testID={
                session.id === 'dream-threshold'
                  ? TID.Option.SessionDreamThreshold
                  : `category.session.${session.id}`
              }
            />
          ))}
        </View>
      </ScrollView>
    </WorldScene>
  );
}
