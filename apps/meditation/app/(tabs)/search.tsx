import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/atmosphere/Screen';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { SessionCard } from '@/components/session/SessionCard';
import { Chip, Rule, Text, TextField } from '@/components/ui';
import { CATEGORIES } from '@/content/categories';
import { SESSIONS } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';
import { searchSessions } from '@/lib/library';
import type { Category } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LENGTHS = [5, 10, 15] as const;

function CategoryTile({ category }: { category: Category }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={() => router.push(`/category/${category.slug}`)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className="w-[48%]">
      <SessionArtwork accent={category.accent} className="min-h-24 justify-end">
        <View className="p-3">
          <Text variant="h3" numberOfLines={1}>
            {t(`category.${category.slug}.name` as TranslationKey)}
          </Text>
        </View>
      </SessionArtwork>
    </AnimatedPressable>
  );
}

export default function SearchTab() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [maxLength, setMaxLength] = useState<number | null>(null);

  const results = useMemo(() => {
    const byLength = maxLength
      ? SESSIONS.filter((session) => session.durationSec <= maxLength * 60)
      : SESSIONS;
    return searchSessions(query, (key) => t(key as TranslationKey), byLength);
  }, [query, maxLength, t]);

  const isFiltered = query.trim().length > 0 || maxLength !== null;

  return (
    <Screen variant="subtle" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-gutter pb-10 pt-4 gap-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('search.title')}</Text>
          <Rule className="self-start" />
        </View>

        <TextField
          label={t('search.title')}
          hideLabel
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoCapitalize="none"
          returnKeyType="search"
        />

        <View className="flex-row flex-wrap gap-2">
          <Chip
            label={t('search.filter.any')}
            selected={maxLength === null}
            onPress={() => setMaxLength(null)}
          />
          {LENGTHS.map((minutes) => (
            <Chip
              key={minutes}
              label={t('search.filter.under', { count: minutes })}
              selected={maxLength === minutes}
              onPress={() => setMaxLength(minutes)}
            />
          ))}
        </View>

        {!isFiltered ? (
          <View className="gap-3">
            <Text variant="h2">{t('search.categories')}</Text>
            <View className="flex-row flex-wrap justify-between gap-3">
              {CATEGORIES.map((category) => (
                <CategoryTile key={category.slug} category={category} />
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <Text variant="h2">{isFiltered
              ? results.length === 1
                ? t('search.results.one')
                : t('search.results', { count: results.length })
              : t('search.all')}</Text>
          <Rule className="self-start" />

          {results.length === 0 ? (
            <View className="gap-2 py-8">
              <Text variant="h3" className="text-center">
                {t('search.empty.title')}
              </Text>
              <Text variant="bodySm" className="text-center">
                {t('search.empty.subtitle')}
              </Text>
            </View>
          ) : (
            results.map((session) => <SessionCard key={session.id} session={session} />)
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
