import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { WorldScene } from '@/components/worlds/WorldScene';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { BenefitList } from '@/components/session/BenefitList';
import { BackLink, Button, Card, IconSymbol, Rule, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import {
  canAccessWorld,
  DEFAULT_WORLD_ID,
  isWorldId,
  WORLD_BY_ID,
} from '@/constants/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import type { TranslationKey } from '@/lib/i18n';
import { formatQuotaResetDate } from '@/lib/entitlements';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';
import { isSessionIncludedInOwnedWorld } from '@/lib/worldJourneys';

export default function SessionDetail() {
  const { id, worldId: worldParam } = useLocalSearchParams<{
    id: string;
    worldId?: string;
  }>();
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isFavorite, toggleFavorite, progress } = useLibrary();
  const { gateForSession, openPaywall, remainingPlays, quotaResetDay, isPlus } = useSubscription();
  const { world: selectedWorld } = useWorld();
  const { isWorldOwned } = useWorldPurchases();
  const fallbackWorld = canAccessWorld(selectedWorld.id, isWorldOwned)
    ? selectedWorld
    : WORLD_BY_ID[DEFAULT_WORLD_ID];
  const world =
    worldParam && isWorldId(worldParam) && canAccessWorld(worldParam, isWorldOwned)
      ? WORLD_BY_ID[worldParam]
      : fallbackWorld;
  const worldColors = Themes[world.appearance];

  const session = id ? SESSION_BY_ID[id] : undefined;

  // A stale deep link to a session that no longer exists must not crash.
  if (!session) {
    return (
      <WorldScene world={world} artwork="trainer" scrimStrength={1.2}>
        <View className="flex-1 items-center justify-center px-gutter">
          <Card className="w-full max-w-md">
            <Text variant="h3">{t('search.empty.title')}</Text>
          </Card>
        </View>
      </WorldScene>
    );
  }

  const entry = progress[session.id];
  const ratio = entry ? entry.positionSec / session.durationSec : 0;
  const canResume = ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
  const saved = isFavorite(session.id);

  const included = isSessionIncludedInOwnedWorld(world.id, session.id, isWorldOwned);
  const gate = included ? { allowed: true as const } : gateForSession(session);
  const remainingCopy =
    remainingPlays === 0
      ? t('paywall.remaining.none')
      : remainingPlays === 1
        ? t('paywall.remaining.one')
        : t('paywall.remaining', { count: remainingPlays });
  const resetLabel = t('paywall.reset', {
    date: formatQuotaResetDate(quotaResetDay, language),
  });
  const showsQuota = !isPlus && !session.isPremium;
  const ctaLabel = !gate.allowed
    ? t('paywall.options')
    : canResume
      ? t('session.resume')
      : (entry?.completedCount ?? 0) > 0
        ? t('session.replay')
        : t('session.play');
  const accessLabel = session.isPremium ? t('common.plus') : t('common.free');

  return (
    <WorldScene world={world} artwork="trainer" edges={['top', 'bottom']}>
      <BackLink
        testID={TID.Button.SessionBack}
        label={t('common.back')}
        iconColor={worldColors.accentText}
        className="px-gutter pb-2 pt-2"
      />

      <ScrollView
        testID={TID.Screen.SessionDetail}
        contentContainerClassName="gap-6 px-gutter pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="gap-2 pt-3">
          <Text variant="overline" testID="session.access">
            {accessLabel}
          </Text>
          {showsQuota ? (
            <View className="gap-1" testID="session.quota">
              <Text variant="caption" tone="muted">
                {remainingCopy}
              </Text>
              <Text variant="caption" tone="muted" testID="session.quota-reset">
                {resetLabel}
              </Text>
            </View>
          ) : null}
          <Text variant="h1">{t(`session.${session.id}.title` as TranslationKey)}</Text>
          <Text variant="bodySm">
            {t('common.minutes', { count: toMinutes(session.durationSec) })} ·{' '}
            {t(`category.${session.categorySlug}.name` as TranslationKey)}
          </Text>
          <PracticeProgress world={world} stage="prepare" className="mt-3" />
          <Text variant="bodySm" tone="muted" numberOfLines={2}>
            {t(`world.${world.id}.ritual` as TranslationKey)}
          </Text>
        </View>

        <Card>
          <View className="gap-6">
            <Text variant="quote">{t(`session.${session.id}.description` as TranslationKey)}</Text>

            <View className="gap-3">
              <Text variant="overline">{t('session.benefits')}</Text>
              <BenefitList session={session} />
            </View>

            {(entry?.completedCount ?? 0) > 0 ? (
              <Text variant="caption">
                {(entry?.completedCount ?? 0) === 1
                  ? t('session.completed.one')
                  : t('session.completed', { count: entry?.completedCount ?? 0 })}
              </Text>
            ) : null}

            {session.isPremium ? (
              <View className="gap-2 border-t border-hairline pt-5">
                <Text variant="h3">{t('session.premium.title')}</Text>
                <Rule className="mt-3 self-start" />
              </View>
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <View className="gap-3 border-t border-hairline bg-ink-raised px-gutter pb-3 pt-3">
        {!gate.allowed && gate.reason === 'monthly-quota' ? (
          <Button
            variant="secondary"
            testID="session.quota-alternative"
            label={t('home.breathe.title')}
            onPress={() => router.push('/breathe')}
          />
        ) : null}
        <Button
          testID={TID.Button.SessionPlay}
          label={ctaLabel}
          onPress={() => {
            // The gate is checked here rather than inside the player: a listener
            // should meet the paywall before the artwork, not after it.
            if (!gate.allowed) {
              openPaywall(gate.reason);
              return;
            }
            router.push(`/player/${session.id}?worldId=${world.id}`);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? t('session.favorite.remove') : t('session.favorite.add')}
          accessibilityState={{ selected: saved }}
          testID={TID.Button.SessionFavorite}
          onPress={() => toggleFavorite(session.id)}
          style={{ minHeight: 48 }}
          className="min-h-12 flex-row items-center justify-center gap-2 py-2 active:opacity-70">
          <IconSymbol
            name={saved ? 'bookmark.fill' : 'bookmark'}
            color={worldColors.accentText}
            size={18}
          />
          <Text variant="bodySm" tone="accent">
            {saved ? t('session.favorite.remove') : t('session.favorite.add')}
          </Text>
        </Pressable>
      </View>
    </WorldScene>
  );
}
