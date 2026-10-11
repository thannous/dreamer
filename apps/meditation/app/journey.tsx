import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { BackLink, Button, IconSymbol, Text } from '@/components/ui';
import { withAlpha, WorldScene } from '@/components/worlds/WorldScene';
import { canAccessWorld, DEFAULT_WORLD_ID, isWorldId, WORLD_BY_ID, type MeditationWorld } from '@/constants/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import { useTheme } from '@/context/ThemeContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

const Artwork = withUniwind(Image);
const CONNECTOR = require('@/assets/worlds/journey-thread.png');

/** One editorial path, with an uninterrupted thread between its chapters. */
function JourneyContent({ world }: { world: MeditationWorld }) {
  const { progress } = useLibrary();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const chapters = world.personality.progression.map((step) => {
    const session = SESSION_BY_ID[step.sessionId];
    const entry = progress[session.id];
    const ratio = entry ? entry.positionSec / session.durationSec : 0;
    return {
      step, session, entry,
      done: (entry?.completedCount ?? 0) > 0,
      resumable: ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO,
    };
  });
  const completedCount = chapters.filter((chapter) => chapter.done).length;
  const resumableChapters = chapters.filter((chapter) => chapter.resumable);
  const featured = resumableChapters.sort((a, b) =>
    (b.entry?.lastPlayedISO ?? '').localeCompare(a.entry?.lastPlayedISO ?? '')
  )[0] ?? chapters.find((chapter) => !chapter.done) ?? chapters[0];

  return (
    <ScrollView testID="screen.journey" contentContainerClassName="grow bg-ink/90 pb-8">
      <View className="min-h-64 justify-between overflow-hidden px-gutter pb-5 pt-3">
        <Artwork accessible={false} source={world.artwork.journey} contentFit="cover"
          contentPosition={{ top: '58%' }} className="absolute inset-0" />
        <LinearGradient pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          colors={[withAlpha(colors.background, 0.65), withAlpha(colors.background, 0.12), colors.background]}
          locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
        <View className="gap-6">
          <BackLink label={t('common.back')} />
          <View className="gap-2">
            <Text variant="overline">{t(world.nameKey)}</Text>
            <Text variant="hero" accessibilityRole="header">{t('journey.title')}</Text>
          </View>
        </View>
        <Text variant="bodySm" testID="journey.complete" className="mt-12">
          {completedCount === chapters.length ? t('journey.complete') + '. ' : ''}
          {t('journey.practised', { count: completedCount, total: chapters.length })}
        </Text>
      </View>

      <View className="px-gutter pt-3">
        {chapters.map(({ step, session, done, resumable }, index) => {
          const isFeatured = session.id === featured.session.id;
          const title = t(`session.${session.id}.title` as TranslationKey);
          const position = t('journey.position', { current: index + 1, total: chapters.length });
          const stage = t(`world.${world.id}.progress.${step.id}` as TranslationKey);
          const status = t(done ? 'journey.done' : resumable ? 'journey.ongoing' : 'journey.todo');
          const meta = `${t('home.journey.minutes', { count: toMinutes(session.durationSec) })} · ${t(
            `category.${session.categorySlug}.name` as TranslationKey
          )}`;
          const openSession = () => router.push(`/session/${session.id}?worldId=${world.id}`);
          return (
            <View key={step.id} className="flex-row gap-3" testID={`journey.step.${session.id}`}>
              <View className="w-11 items-center" accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants" pointerEvents="none">
                <Text variant="chapter" tone="accent" maxFontSizeMultiplier={1.3} numberOfLines={1}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View className="mt-1 h-px w-5 bg-champagne" />
                {index < chapters.length - 1 ? (
                  <View className="my-2 w-11 flex-1 overflow-hidden">
                    <Artwork source={CONNECTOR} contentFit="fill" className="absolute -left-[58px] bottom-0 top-0 w-40"
                      tintColor={world.appearance === 'light' ? colors.accentDark : undefined} />
                  </View>
                ) : null}
              </View>
              <View className={`min-w-0 flex-1 pb-6 ${index < chapters.length - 1 ? 'mb-6 border-b border-hairline' : ''}`}>
                <Pressable testID={`btn.journey.session.${session.id}`} accessibilityRole="button"
                  accessibilityLabel={`${position}. ${stage}. ${title}. ${meta}. ${status}. ${t('journey.details')}`}
                  onPress={openSession} className="min-h-12 gap-1 active:opacity-80">
                  {isFeatured ? (
                    <Artwork accessible={false} source={world.artwork.journey} contentFit="cover"
                      contentPosition={{ top: '70%' }} className="absolute right-0 top-2 h-20 w-20 rounded-full border border-hairline" />
                  ) : null}
                  <Text variant="bodySm">{position}</Text>
                  <Text variant="bodySm" className={isFeatured ? 'pr-20' : undefined}>{stage}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text variant="chapter" className={`min-w-0 flex-1 ${isFeatured ? 'pr-20' : ''}`}>{title}</Text>
                    {isFeatured ? null : <IconSymbol name="chevron.right" size={24} color={colors.textSecondary} />}
                  </View>
                  {isFeatured ? <Text variant="bodySm">{meta}</Text> : null}
                  <View className="mt-1 flex-row items-center gap-2">
                    {done ? (
                      <View className="h-5 w-5 items-center justify-center rounded-full bg-champagne">
                        <IconSymbol name="checkmark" size={15} color={colors.textOnAccent} />
                      </View>
                    ) : null}
                    <Text variant="bodySm" tone="default">{status}</Text>
                  </View>
                </Pressable>
                {isFeatured ? (
                  <Button className="mt-5" size="md" luminous
                    testID={resumable ? `btn.journey.resume.${session.id}` : `btn.journey.featured.${session.id}`}
                    label={t(resumable ? 'session.resume' : 'journey.details')}
                    onPress={resumable
                      ? () => router.push(`/player/${session.id}?worldId=${world.id}`)
                      : openSession} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function JourneyScreen() {
  const { worldId } = useLocalSearchParams<{ worldId?: string }>();
  const { world: selectedWorld } = useWorld();
  const { isWorldOwned } = useWorldPurchases();
  const requested = worldId && isWorldId(worldId) ? WORLD_BY_ID[worldId] : selectedWorld;
  const world = canAccessWorld(requested.id, isWorldOwned) ? requested : WORLD_BY_ID[DEFAULT_WORLD_ID];

  return (
    <WorldScene world={world} artwork="journey">
      <JourneyContent world={world} />
    </WorldScene>
  );
}
