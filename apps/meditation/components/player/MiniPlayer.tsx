import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SessionArtwork } from '@/components/session/SessionArtwork';
import { IconSymbol, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Persistent playback strip above the tab bar.
 *
 * Hidden on the full-screen player itself — showing a miniature of the screen
 * you are already on is noise.
 */
export function MiniPlayer() {
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();
  const { session, status, toggle } = usePlayer();
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  const onPlayerScreen = segments.some((segment) => segment === 'player');
  if (!session || status === 'idle' || onPlayerScreen) return null;

  /**
   * No entrance animation on purpose.
   *
   * Both attempts stranded the strip at partial opacity on web — `FadeInDown`
   * never settles, and a shared value driven from an effect never ran. The
   * strip appearing is already carried by the screen transition, and a control
   * that is sometimes invisible is a far worse defect than a missing fade.
   */
  const playing = status === 'playing';

  return (
    <Animated.View className="border-t border-hairline bg-ink-card">
      <View className="flex-row items-center gap-3 px-gutter py-2">
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={t('mini.playing')}
          onPress={() => router.push(`/player/${session.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={style}
          className="flex-1 flex-row items-center gap-3">
          <SessionArtwork accent={session.accent} rounded="md" className="h-10 w-10" />
          <Text variant="bodySm" tone="default" numberOfLines={1} className="flex-1">
            {t(`session.${session.id}.title` as TranslationKey)}
          </Text>
        </AnimatedPressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('player.pause') : t('player.play')}
          onPress={toggle}
          hitSlop={{ top: 4, bottom: 4, left: 12, right: 12 }}
          className="h-9 w-9 items-center justify-center rounded-full border border-hairline active:opacity-70">
          <IconSymbol
            name={playing ? 'pause.fill' : 'play.fill'}
            color={colors.accentText}
            size={18}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}
