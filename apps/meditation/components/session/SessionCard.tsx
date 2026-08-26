import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkGlassPanel, Text } from '@/components/ui';
import { getSessionArtwork } from '@/constants/catalogArtwork';
import type { ThemeMode } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
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
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  const title = t(`session.${session.id}.title` as TranslationKey);
  const minutes = toMinutes(session.durationSec);
  const meta = `${t('common.minutes', { count: minutes })} · ${t(
    `category.${session.categorySlug}.name` as TranslationKey
  )}`;
  const artwork = getSessionArtwork(session.id, appearance);

  const open = () => router.push(`/session/${session.id}`);

  if (variant === 'feature') {
    return (
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${meta}`}
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
            {session.isPremium ? <Text variant="overline">{t('common.plus')}</Text> : null}
            <Text variant="h1">{title}</Text>
            <Text variant="bodySm">{meta}</Text>
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
      <View className="flex-1">
        <Text variant="h3" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" tone={appearance ? 'default' : undefined} className="mt-1">
          {meta}
        </Text>
      </View>
      {session.isPremium ? <Text variant="overline">{t('common.plus')}</Text> : null}
    </>
  );

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      onPress={open}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={appearance ? 'rounded-xl' : 'flex-row items-center gap-4 rounded-xl border border-hairline bg-ink-card p-3'}>
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
    alignItems: 'center',
    gap: 16,
    padding: 12,
  },
});
