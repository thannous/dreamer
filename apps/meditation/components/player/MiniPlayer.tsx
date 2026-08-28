import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { SessionArtwork } from '@/components/session/SessionArtwork';
import { IconSymbol, Text } from '@/components/ui';
import { getSessionArtwork } from '@/constants/catalogArtwork';
import { WORLD_BY_ID } from '@/constants/worlds';
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
  const { session, worldId, status, toggle } = usePlayer();
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.6;

  const onPlayerScreen = segments.some((segment) => segment === 'player');
  // An unavailable session owns no playable handle. Keeping a mini-player for
  // it would expose a play button that can never respond after leaving the
  // immersive error state.
  if (!session || status === 'idle' || status === 'unavailable' || onPlayerScreen) return null;

  const artwork = getSessionArtwork(
    session.id,
    worldId ? WORLD_BY_ID[worldId].appearance : 'dark'
  );

  /**
   * No entrance animation on purpose.
   *
   * Both attempts stranded the strip at partial opacity on web — `FadeInDown`
   * never settles, and a shared value driven from an effect never ran. The
   * strip appearing is already carried by the screen transition, and a control
   * that is sometimes invisible is a far worse defect than a missing fade.
   */
  const playing = status === 'playing';
  const sessionTitle = t(`session.${session.id}.title` as TranslationKey);

  return (
    <Animated.View
      className={`mx-2.5 overflow-hidden border border-hairline bg-ink-raised ${
        largeText ? 'rounded-3xl' : 'rounded-full'
      }`}>
      <View
        className={`flex-row gap-3 px-gutter py-2 ${
          largeText ? 'items-start' : 'items-center'
        }`}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`${t('mini.playing')}. ${sessionTitle}`}
          testID="btn.mini.open"
          onPress={() =>
            router.push(
              worldId ? `/player/${session.id}?worldId=${worldId}` : `/player/${session.id}`
            )
          }
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={style}
          className={`min-h-12 min-w-0 flex-1 flex-row gap-3 ${
            largeText ? 'items-start' : 'items-center'
          }`}>
          <SessionArtwork
            accent={session.accent}
            source={artwork}
            rounded="md"
            className={`h-10 w-10 ${largeText ? 'mt-1' : ''}`}
          />
          <Text
            variant="bodySm"
            tone="default"
            testID="mini.session-title"
            className="min-w-0 flex-1">
            {sessionTitle}
          </Text>
        </AnimatedPressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('player.pause') : t('player.play')}
          accessibilityState={{ selected: playing }}
          testID="btn.mini.toggle"
          onPress={toggle}
          hitSlop={8}
          style={{ minHeight: 48, minWidth: 48 }}
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hairline active:opacity-70">
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
