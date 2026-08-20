import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BenefitList } from '@/components/session/BenefitList';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { BackLink, Button, Card, IconSymbol, Rule, Text } from '@/components/ui';
import { NARRATOR_BY_ID } from '@/content/narrators';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useTheme } from '@/context/ThemeContext';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite, progress } = useLibrary();
  const { gateForSession, openPaywall } = useSubscription();
  const { colors } = useTheme();

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
      <BackLink
        testID={TID.Button.SessionBack}
        label={t('common.back')}
        className="px-gutter pb-2 pt-2"
      />

      <ScrollView
        testID={TID.Screen.SessionDetail}
        contentContainerClassName="pb-10 gap-6"
        showsVerticalScrollIndicator={false}>
        <SessionArtwork
          accent={session.accent}
          rounded="artwork"
          className="mx-gutter min-h-56 justify-end">
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

          {/* A wordless session has no one guiding it, so it gets no "guided
              by" and no name line — the label carries the whole idea, and the
              player already says the same thing the same way. */}
          <Card>
            <Text variant="overline">
              {session.narratorId === 'wordless'
                ? t('session.narrator.wordless')
                : t('session.narrator')}
            </Text>
            {session.narratorId === 'wordless' ? null : (
              <Text variant="h3" className="mt-2">
                {narrator.name}
              </Text>
            )}
            <Text variant="bodySm" className="mt-2">
              {t(`narrator.${session.narratorId}.bio` as TranslationKey)}
            </Text>
          </Card>

          {(entry?.completedCount ?? 0) > 0 ? (
            <Text variant="caption">
              {(entry?.completedCount ?? 0) === 1
                ? t('session.completed.one')
                : t('session.completed', { count: entry?.completedCount ?? 0 })}
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
        <Button
          testID={TID.Button.SessionPlay}
          label={ctaLabel}
          onPress={() => {
            // The gate is checked here rather than inside the player: a listener
            // should meet the paywall before the artwork, not after it.
            const gate = gateForSession(session);
            if (!gate.allowed) {
              openPaywall(gate.reason);
              return;
            }
            router.push(`/player/${session.id}`);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          testID={TID.Button.SessionFavorite}
          onPress={() => toggleFavorite(session.id)}
          className="flex-row items-center justify-center gap-2 py-2 active:opacity-70">
          <IconSymbol
            name={saved ? 'bookmark.fill' : 'bookmark'}
            color={colors.accentText}
            size={18}
          />
          <Text variant="bodySm" tone="accent">
            {saved ? t('session.favorite.remove') : t('session.favorite.add')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
