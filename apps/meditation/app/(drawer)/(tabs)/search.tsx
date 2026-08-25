import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyIllustration } from '@/components/atmosphere/EmptyIllustration';
import { SessionCard } from '@/components/session/SessionCard';
import { ArtworkGlassPanel, Chip, Rule, Text, TextField } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { getCategoryArtwork } from '@/constants/catalogArtwork';
import { Atmosphere, Themes, type ThemeMode } from '@/constants/theme';
import { CATEGORIES } from '@/content/categories';
import { SESSIONS } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import { TID } from '@/lib/testIDs';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';
import { searchSessions } from '@/lib/library';
import type { Category } from '@/lib/types';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { useWorld } from '@/context/WorldContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LENGTHS = [5, 10, 15] as const;

function CategoryTile({
  category,
  compact,
  appearance,
}: {
  category: Category;
  compact: boolean;
  appearance: ThemeMode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      testID={category.slug === 'dream-prep' ? TID.Option.CategoryDreamPrep : undefined}
      accessibilityRole="button"
      onPress={() => router.push(`/category/${category.slug}`)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className="w-[48%] rounded-xl">
      <ArtworkGlassPanel
        appearance={appearance}
        artwork={getCategoryArtwork(category.slug, appearance)}
        contentStyle={compact ? styles.compactCategory : styles.category}
        style={{ borderLeftColor: category.accent[0], borderLeftWidth: 3 }}
        testID={`search.category-glass.${category.slug}`}>
        <Text variant="h3" numberOfLines={1}>
          {t(`category.${category.slug}.name` as TranslationKey)}
        </Text>
      </ArtworkGlassPanel>
    </AnimatedPressable>
  );
}

export default function SearchTab() {
  const tabBarInset = useTabBarInset();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [maxLength, setMaxLength] = useState<number | null>(null);
  const compact = useCompactLayout();
  const { world } = useWorld();
  const worldColors = Themes[world.appearance];

  const results = useMemo(() => {
    const byLength = maxLength
      ? SESSIONS.filter((session) => session.durationSec <= maxLength * 60)
      : SESSIONS;
    return searchSessions(query, (key) => t(key as TranslationKey), byLength);
  }, [query, maxLength, t]);

  const isFiltered = query.trim().length > 0 || maxLength !== null;

  // Zero and one are their own words in most languages — "0 séances" is wrong
  // in French, and "Aucune séance" reads better than a digit anyway.
  const countLabel =
    results.length === 0
      ? t('search.results.zero')
      : results.length === 1
        ? t('search.results.one')
        : t('search.results', { count: results.length });

  return (
    <WorldScene
      world={world}
      artwork="journey"
      edges={['top']}
      scrimStrength={1.12}>
      <ScrollView
        testID={TID.Screen.Search}
        contentContainerClassName={compact ? 'gap-4 px-4 pt-3' : 'gap-6 px-gutter pt-4'}
        contentContainerStyle={{ paddingBottom: tabBarInset }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant={compact ? 'h2' : 'h1'}>{t('search.title')}</Text>
          <Rule className="self-start" />
        </View>

        <TextField
          label={t('search.title')}
          hideLabel
          icon="magnifyingglass"
          appearance={world.appearance}
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
          <View className={compact ? 'gap-2' : 'gap-3'}>
            <Text variant="h2">{t('search.categories')}</Text>
            <View className={`flex-row flex-wrap justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
              {CATEGORIES.map((category) => (
                <CategoryTile
                  key={category.slug}
                  category={category}
                  compact={compact}
                  appearance={world.appearance}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <Text variant="h2">{isFiltered ? countLabel : t('search.all')}</Text>
          <Rule className="self-start" />

          {results.length === 0 ? (
            <ArtworkGlassPanel
              appearance={world.appearance}
              contentStyle={styles.emptyState}
              testID="search.empty-glass">
              <EmptyIllustration
                name="search"
                lineColor={worldColors.accentText}
                dustColor={Atmosphere[world.appearance].star}
              />
              <Text variant="h3" className="text-center">
                {t('search.empty.title')}
              </Text>
              <Text variant="bodySm" className="text-center">
                {t('search.empty.subtitle')}
              </Text>
            </ArtworkGlassPanel>
          ) : (
            results.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                appearance={world.appearance}
                testID={
                  session.id === 'sleep-descent' ? TID.Option.SearchSleepDescent : undefined
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </WorldScene>
  );
}

const styles = StyleSheet.create({
  compactCategory: {
    minHeight: 80,
    justifyContent: 'flex-end',
    padding: 12,
  },
  category: {
    minHeight: 96,
    justifyContent: 'flex-end',
    padding: 12,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
});
