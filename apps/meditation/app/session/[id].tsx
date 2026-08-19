import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BenefitList } from '@/components/session/BenefitList';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { BackLink, Button, Card, Rule, Text } from '@/components/ui';
import { NARRATOR_BY_ID } from '@/content/narrators';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite, progress } = useLibrary();

  const session = id ? SESSION_BY_ID[id] : undefined;

  // A stale deep link to a session that no longer exists must not crash.
  if (!session) {
    return (
      <Screen variant="subtle">
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="h3">{t('search.empty.title')}</Text>
        </View>
      </Screen>
    );
  }

  const narrator = NARRATOR_BY_ID[session.narratorId];
  const entry = progress[session.id];
  const ratio = entry ? entry.positionSec / session.durationSec : 0;
  const canResume = ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
  const saved = isFavorite(session.id);

  const ctaLabel = canResume
    ? t('session.resume')
    : (entry?.completedCount ?? 0) > 0
      ? t('session.replay')
      : t('session.play');

  return (
    <Screen variant="immersive" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pb-2 pt-2" />

      <ScrollView
        contentContainerClassName="pb-10 gap-6"
        showsVerticalScrollIndicator={false}>
        <SessionArtwork
          accent={session.accent}
          rounded="artwork"
          className="mx-gutter h-56 justify-end">
          <View className="gap-1 p-gutter">
            {session.isPremium ? <Text variant="overline">{t('common.plus')}</Text> : null}
            <Text variant="h1">{t(`session.${session.id}.title` as TranslationKey)}</Text>
            <Text variant="bodySm">
              {t('common.minutes', { count: toMinutes(session.durationSec) })} ·{' '}
              {t(`category.${session.categorySlug}.name` as TranslationKey)}
            </Text>
          </View>
        </SessionArtwork>

        <View className="gap-6 px-gutter">
          <Text variant="quote">{t(`session.${session.id}.description` as TranslationKey)}</Text>

          <View className="gap-3">
            <Text variant="overline">{t('session.benefits')}</Text>
            <BenefitList session={session} />
          </View>

          <Card>
            <Text variant="overline">{t('session.narrator')}</Text>
            <Text variant="h3" className="mt-2">
              {session.narratorId === 'wordless' ? t('session.narrator.wordless') : narrator.name}
            </Text>
            <Text variant="bodySm" className="mt-1">
              {t(`narrator.${session.narratorId}.bio` as TranslationKey)}
            </Text>
          </Card>

          {(entry?.completedCount ?? 0) > 0 ? (
            <Text variant="caption">
              {t('session.completed', { count: entry?.completedCount ?? 0 })}
            </Text>
          ) : null}

          {session.isPremium ? (
            <Card featured>
              <Text variant="h3">{t('session.premium.title')}</Text>
              <Rule className="mt-3 self-start" />
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View className="gap-3 px-gutter pb-4">
        <Button label={ctaLabel} onPress={() => router.push(`/player/${session.id}`)} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          onPress={() => toggleFavorite(session.id)}
          className="items-center py-2 active:opacity-70">
          <Text variant="bodySm" tone="accent">
            {saved ? t('session.favorite.remove') : t('session.favorite.add')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
