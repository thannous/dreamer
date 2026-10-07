import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { SessionArtwork } from '@/components/session/SessionArtwork';
import { IconSymbol, Text } from '@/components/ui';
import { getSessionArtwork } from '@/constants/catalogArtwork';
import { WORLD_BY_ID } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { usePlayerCommands, usePlayerState } from '@/context/PlayerContext';
import { useTheme } from '@/context/ThemeContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Persistent playback strip above the tab bar.
 *
 * Hidden on the full-screen player itself — showing a miniature of the screen
 * you are already on is noise.
 */
export function isCompactPlayerScreen(segments: readonly string[]) {
  return segments.some((segment) => ['(tabs)', 'session', 'journey', 'history', 'favorites', 'settings'].includes(segment));
}

export function MiniPlayer() {
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();
  const { session, worldId, status } = usePlayerState();
  const { toggle, close } = usePlayerCommands();
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.6;

  const onPlayerScreen = segments.some((segment) => segment === 'player');
  const onCompactScreen = isCompactPlayerScreen(segments);
  const visible = !!session && status !== 'idle' && status !== 'unavailable' && onCompactScreen;
  const wasOnPlayer = useRef(onPlayerScreen);
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const entranceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    // One cue when leaving the immersive player. Audio ticks and tab changes
    // never replay it. Opacity stays at 1 even if motion fails or is interrupted.
    if (wasOnPlayer.current && visible && !reducedMotion) {
      offset.set(12);
      offset.set(withTiming(0, {
        duration: 200,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        reduceMotion: ReduceMotion.System,
      }));
    }
    wasOnPlayer.current = onPlayerScreen;
    return () => { cancelAnimation(offset); offset.set(0); };
  }, [onPlayerScreen, visible, reducedMotion, offset]);
  // An unavailable session owns no playable handle. Keeping a mini-player for
  // it would expose a play button that can never respond after leaving the
  // immersive error state.
  if (!session || !visible) return null;

  const artwork = getSessionArtwork(
    session.id,
    worldId ? WORLD_BY_ID[worldId].appearance : 'dark'
  );

  const playing = status === 'playing';
  const loading = status === 'loading';
  const stateLabel = t(loading ? 'mini.loading' : playing ? 'mini.active' : 'mini.paused');
  const sessionTitle = t(`session.${session.id}.title` as TranslationKey);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      testID="mini.player"
      style={entranceStyle}
      className={`mx-2.5 overflow-hidden border border-champagne bg-ink-raised ${
        largeText ? 'rounded-3xl' : 'rounded-2xl'
      }`}>
      <View
        className={`flex-row gap-2 px-3 py-3 ${
          largeText ? 'items-start' : 'items-center'
        }`}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`${t('mini.playing')}. ${sessionTitle}`}
          accessibilityHint={stateLabel}
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
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="caption" tone="accent" testID="mini.state">{stateLabel}</Text>
            <Text variant="bodySm" tone="default" testID="mini.session-title">
              {sessionTitle}
            </Text>
          </View>
        </AnimatedPressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('player.pause') : t('player.play')}
          accessibilityState={{ selected: playing, disabled: loading }}
          disabled={loading}
          testID="btn.mini.toggle"
          onPress={toggle}
          hitSlop={8}
          style={{ minHeight: 48, minWidth: 48 }}
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-champagne bg-champagne active:opacity-70">
          <IconSymbol
            name={playing ? 'pause.fill' : 'play.fill'}
            color={colors.textOnAccent}
            size={18}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('player.close')}
          testID="btn.mini.close"
          onPress={close}
          hitSlop={8}
          style={{ minHeight: 48, minWidth: 48 }}
          className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hairline active:opacity-70">
          <IconSymbol
            name="xmark"
            color={colors.accentText}
            size={18}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}
