import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkGlassPanel, Text } from '@/components/ui';
import { getSessionArtwork } from '@/constants/catalogArtwork';
import type { ThemeMode } from '@/constants/theme';
import { getSessionPractice } from '@/content/sessionPractice';
import { useLibrary } from '@/context/LibraryContext';
import { useTranslation } from '@/context/LanguageContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import type { MeditationSession } from '@/lib/types';

import { SessionArtwork } from './SessionArtwork';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  session: MeditationSession;
  /** `row` for lists, `feature` for the one hero card on a screen. */
  variant?: 'row' | 'feature';
  appearance?: ThemeMode;
  testID?: string;
};

export function SessionCard({ session, variant = 'row', appearance, testID }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { favorites } = useLibrary();
  const { subscriptionsEnabled = true, isPlus } = useSubscription();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  const title = t(`session.${session.id}.title` as TranslationKey);
  const minutes = toMinutes(session.durationSec);
  const category = t(`category.${session.categorySlug}.name` as TranslationKey);
  const practice = getSessionPractice(session.id);
  const method = t(`session.method.${practice.method}` as TranslationKey);
  const guidance = t(`session.guidance.${practice.guidance}` as TranslationKey);
  const methodLabel = t('session.method.label', { method });
  const guidanceLabel = t('session.guidance.label', { guidance });
  const benefits = Array.from({ length: session.benefitCount }, (_, index) =>
    t(`session.${session.id}.benefit.${index + 1}` as TranslationKey)
  );
  const unlockedPremium = session.isPremium && isPlus;
  const accessLabel =
    session.isPremium && subscriptionsEnabled
      ? unlockedPremium
        ? t('paywall.active.title')
        : t('common.plus')
      : t('common.free');
  const saved = favorites.includes(session.id);
  const savedLabel = saved
    ? session.isPremium && !unlockedPremium
      ? t('session.saved.locked')
      : t('favorites.title')
    : null;
  const durationMeta = `${t('common.minutes', { count: minutes })} · ${category}`;
  const artwork = getSessionArtwork(session.id, appearance);
  const accessibilityLabel = [title, durationMeta, methodLabel, guidanceLabel, ...benefits, accessLabel, savedLabel]
    .filter(Boolean)
    .join('. ');

  const open = () => router.push(`/session/${session.id}`);

  const accessBadge = (
    <Text variant="overline" testID={testID ? `${testID}.access` : undefined}>
      {accessLabel}
    </Text>
  );

  const practiceLine = (
    <View className="mt-1 gap-0.5" testID={testID ? `${testID}.practice` : undefined}>
      <Text
        variant="caption"
        tone="muted"
        testID={testID ? `${testID}.method` : undefined}>
        {methodLabel}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        testID={testID ? `${testID}.guidance` : undefined}>
        {guidanceLabel}
      </Text>
    </View>
  );

  const benefitList = (
    <View className="mt-1 gap-0.5" testID={testID ? `${testID}.benefits` : undefined}>
      {benefits.map((benefit, index) => (
        <Text
          key={`${session.id}.benefit.${index + 1}`}
          variant="caption"
          testID={testID ? `${testID}.benefit.${index + 1}` : undefined}>
          {benefit}
        </Text>
      ))}
    </View>
  );

  if (variant === 'feature') {
    return (
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={open}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}>
        <SessionArtwork
          accent={session.accent}
          source={artwork}
          rounded="artwork"
          className="min-h-48 justify-end">
          <View className="gap-1 p-gutter">
            <View className="flex-row flex-wrap items-center gap-2">
              {accessBadge}
              {savedLabel ? (
                <Text variant="caption" tone="muted" testID={testID ? `${testID}.saved` : undefined}>
                  {savedLabel}
                </Text>
              ) : null}
            </View>
            <Text variant="h1" testID={testID ? `${testID}.title` : undefined}>
              {title}
            </Text>
            <Text variant="bodySm">{durationMeta}</Text>
            {practiceLine}
            {benefitList}
          </View>
        </SessionArtwork>
      </AnimatedPressable>
    );
  }

  const rowContent = (
    <>
      {!appearance ? (
        <SessionArtwork
          accent={session.accent}
          source={artwork}
          rounded="md"
          className="h-16 w-16"
        />
      ) : null}
      <View className="min-w-0 flex-1">
        <Text variant="h3" testID={testID ? `${testID}.title` : undefined}>
          {title}
        </Text>
        <Text variant="bodySm" tone={appearance ? 'default' : undefined} className="mt-1">
          {durationMeta}
        </Text>
        {practiceLine}
        {benefitList}
        {savedLabel ? (
          <Text variant="caption" className="mt-1" testID={testID ? `${testID}.saved` : undefined}>
            {savedLabel}
          </Text>
        ) : null}
      </View>
      <View className="ml-2 max-w-[30%] items-end">{accessBadge}</View>
    </>
  );

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={open}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={
        appearance
          ? 'rounded-xl'
          : 'flex-row items-start gap-4 rounded-xl border border-hairline bg-ink-card p-3'
      }>
      {appearance ? (
        <ArtworkGlassPanel
          appearance={appearance}
          artwork={artwork}
          contentStyle={styles.glassRow}
          testID={testID ? `${testID}.glass` : undefined}>
          {rowContent}
        </ArtworkGlassPanel>
      ) : (
        rowContent
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  glassRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 12,
  },
});
