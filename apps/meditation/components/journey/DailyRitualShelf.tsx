import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ACTIVE_JOURNEY_CTA_TEST_ID } from '@/components/journey/WorldJourneyPicker';
import { WorldPathProgress } from '@/components/journey/WorldPathProgress';
import { ArtworkGlassPanel, Button, IconSymbol, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import type { MeditationWorld } from '@/constants/worlds';
import { formatQuotaResetDate, type Gate, type GateReason } from '@/lib/entitlements';
import type { MeditationSession, SessionId, SessionProgress } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { RESUME_MAX_RATIO, RESUME_MIN_RATIO } from '@/lib/types';

type Props = {
  session: MeditationSession;
  sessionProgress?: SessionProgress;
  journeyProgress: Record<SessionId, SessionProgress>;
  world: MeditationWorld;
  recommendationSource?: 'world' | 'catalogue';
  isSessionIncluded?: (sessionId: SessionId) => boolean;
  accessGate: Gate;
  remainingPlays: number;
  quotaResetDay: string;
  isPlus: boolean;
  onOpen: (resume: boolean) => void;
  onOpenPaywall: (reason: GateReason) => void;
  onOpenAlternative?: () => void;
};

function remainingQuotaCopy(
  remainingPlays: number,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
): string {
  if (remainingPlays === 0) return t('paywall.remaining.none');
  if (remainingPlays === 1) return t('paywall.remaining.one');
  return t('paywall.remaining', { count: remainingPlays });
}

/**
 * The only glass-like support shelf on the immersive home. It carries one
 * choice, not a carousel: enter today's ritual or continue it where it stopped.
 */
export function DailyRitualShelf({
  session,
  sessionProgress,
  journeyProgress,
  world,
  recommendationSource = 'world',
  isSessionIncluded,
  accessGate,
  remainingPlays,
  quotaResetDay,
  isPlus,
  onOpen,
  onOpenPaywall,
  onOpenAlternative,
}: Props) {
  const { t, language } = useTranslation();
  const ratio = sessionProgress ? sessionProgress.positionSec / session.durationSec : 0;
  const canResume = ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
  const progressPercent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const title = t(`session.${session.id}.title` as TranslationKey);
  const included = isSessionIncluded?.(session.id) ?? false;
  const gate: Gate = included ? { allowed: true } : accessGate;
  const blockedReason = gate.allowed ? null : gate.reason;
  const showsPlus = session.isPremium && !included;
  const accessLabel = showsPlus
    ? t('common.plus')
    : blockedReason === 'monthly-quota'
      ? t('home.journey.quotaUsed')
      : t('common.free');
  const quotaRelevant =
    !isPlus && !included && !showsPlus && Number.isFinite(remainingPlays);
  const quotaCopy = quotaRelevant ? remainingQuotaCopy(remainingPlays, t) : null;
  const meta = `${t('home.journey.minutes', { count: toMinutes(session.durationSec) })} · ${t(
    `category.${session.categorySlug}.name` as TranslationKey
  )}`;

  const resetLabel = t('paywall.reset', {
    date: formatQuotaResetDate(quotaResetDay, language),
  });
  const ctaKey: TranslationKey =
    blockedReason === 'premium-session' || blockedReason === 'monthly-quota'
      ? 'paywall.options'
      : canResume
        ? 'session.resume'
        : 'session.play';
  const accessibilityLead: TranslationKey =
    blockedReason === 'premium-session' || blockedReason === 'monthly-quota'
      ? 'paywall.options'
      : canResume
        ? 'home.journey.continue'
        : 'home.journey.begin';

  return (
      <ArtworkGlassPanel
        appearance={world.appearance}
        contentStyle={styles.content}
        testID="home.journey.ritual-glass">
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="overline" testID="home.journey.ritual-overline">
              {recommendationSource === 'catalogue'
                ? t('home.recommended.forYou')
                : t(`world.${world.id}.role` as TranslationKey)}
            </Text>
            {recommendationSource === 'catalogue' ? null : (
              <Text variant="caption" tone="muted">
                {t(`world.${world.id}.moment` as TranslationKey)}
              </Text>
            )}
          </View>
          {recommendationSource === 'catalogue' ? null : (
            <WorldPathProgress world={world} progress={journeyProgress} />
          )}
          <Text variant="h2" testID="home.journey.ritual-title">
            {title}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            <IconSymbol name="clock" size={15} color={Themes[world.appearance].textSecondary} />
            <Text variant="bodySm">{meta}</Text>
            <Text variant="overline" testID="home.journey.ritual-access">
              {accessLabel}
            </Text>
          </View>
          {quotaCopy ? (
            <View className="gap-1" testID="home.journey.quota">
              <Text variant="caption" tone="muted">
                {quotaCopy}
              </Text>
              <Text variant="caption" tone="muted" testID="home.journey.quota-reset">
                {resetLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {canResume ? (
          <View
            className="mt-4 gap-2"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={title}
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}>
            <View className="h-1 overflow-hidden rounded-full bg-ink-panel">
              <View
                className="h-full rounded-full bg-champagne"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
          </View>
        ) : null}

        <Button
          testID={ACTIVE_JOURNEY_CTA_TEST_ID}
          className="mt-5"
          label={t(ctaKey)}
          accessibilityLabel={`${t(accessibilityLead)}. ${title}. ${meta}. ${accessLabel}`}
          onPress={() => {
            if (blockedReason) {
              onOpenPaywall(blockedReason);
              return;
            }
            onOpen(canResume);
          }}
        />
        {blockedReason && onOpenAlternative ? (
          <Button
            className="mt-2"
            variant="secondary"
            testID="home.journey.quota-alternative"
            label={t('home.breathe.title')}
            accessibilityLabel={t('home.breathe.subtitle')}
            onPress={onOpenAlternative}
          />
        ) : null}
      </ArtworkGlassPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});
