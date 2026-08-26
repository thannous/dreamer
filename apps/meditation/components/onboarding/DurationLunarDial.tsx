import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { IconSymbol, Text } from '@/components/ui';
import { BreathAmplitude } from '@/constants/motion';
import { NightTheme } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useBreath } from '@/context/BreathContext';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TID } from '@/lib/testIDs';
import { DAILY_INTENTIONS, type DailyIntention } from '@/lib/types';

const PORTAL_ARTWORK = require('@/assets/onboarding/intention/lunar-duration-v1.webp');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  description: string;
  nextLabel: string;
  onChange: (value: DailyIntention) => void;
  previousLabel: string;
  value: DailyIntention;
  valueLabel: string;
};

type DirectionButtonProps = {
  accessibilityLabel: string;
  disabled: boolean;
  direction: 'previous' | 'next';
  onPress: () => void;
  testID: string;
};

function DirectionButton({
  accessibilityLabel,
  disabled,
  direction,
  onPress,
  testID,
}: DirectionButtonProps) {
  const press = usePressMotion({ surface: 'chip', restOpacity: disabled ? 0.34 : 1 });

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      onPressIn={press.handlePressIn}
      onPressOut={press.handlePressOut}
      pressRetentionOffset={12}
      style={[styles.arrowButton, press.style]}>
      <IconSymbol
        name={direction === 'previous' ? 'chevron.left' : 'chevron.right'}
        color={disabled ? NightTheme.textTertiary : NightTheme.accentText}
        size={34}
      />
    </AnimatedPressable>
  );
}

/**
 * The daily commitment is tuned like an instrument rather than picked from a
 * settings list. The portal shares the app-wide breath; a tap only settles the
 * live value, keeping the interaction legible without adding another motion
 * language to onboarding.
 */
export function DurationLunarDial({
  description,
  nextLabel,
  onChange,
  previousLabel,
  value,
  valueLabel,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = useCompactLayout();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const { progress } = useBreath();
  const settle = useSharedValue(1);
  const previousValue = useRef(value);
  const index = DAILY_INTENTIONS.indexOf(value);
  const dialSize = Math.min(width - 8, compact ? 350 : 390);
  const previous = DAILY_INTENTIONS[index - 1];
  const next = DAILY_INTENTIONS[index + 1];

  useEffect(() => {
    if (!isFocused) {
      cancelAnimation(settle);
      settle.set(1);
      return;
    }

    if (previousValue.current === value) return;
    previousValue.current = value;

    if (reducedMotion) {
      settle.set(1);
      return;
    }

    settle.set(0.97);
    settle.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
  }, [isFocused, reducedMotion, settle, value]);

  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0.96, 1]),
    transform: [
      {
        scale: reducedMotion
          ? 1
          : interpolate(progress.get(), [0, 1], [1, 1 + BreathAmplitude.ring]),
      },
    ],
  }));

  const selectionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(settle.get(), [0.97, 1], [0.82, 1]),
    transform: [{ scale: reducedMotion ? 1 : settle.get() }],
  }));

  return (
    <Animated.View
      style={[
        styles.dial,
        { borderRadius: dialSize / 2, height: dialSize, width: dialSize },
        isFocused ? breathStyle : styles.motionRest,
      ]}>
      <Image
        accessible={false}
        source={PORTAL_ARTWORK}
        contentFit="contain"
        recyclingKey="onboarding-intention-lunar-duration"
        style={[StyleSheet.absoluteFill, styles.portalImage]}
      />

      <View pointerEvents="box-none" style={styles.controls}>
        <DirectionButton
          testID={TID.Button.IntentionPrevious}
          accessibilityLabel={previousLabel}
          direction="previous"
          disabled={!previous}
          onPress={() => previous && onChange(previous)}
        />

        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${valueLabel}. ${description}`}
          style={[styles.valueStack, isFocused ? selectionStyle : styles.motionRest]}>
          <Text
            testID={TID.Text.IntentionDuration}
            variant="display"
            tone="accent"
            maxFontSizeMultiplier={1.25}
            style={[styles.value, compact ? styles.valueCompact : null]}>
            {valueLabel}
          </Text>
          <Text
            variant="bodySm"
            maxFontSizeMultiplier={1.35}
            className="mt-1 text-center">
            {description}
          </Text>
          <View style={styles.valueRule} />
        </Animated.View>

        <DirectionButton
          testID={TID.Button.IntentionNext}
          accessibilityLabel={nextLabel}
          direction="next"
          disabled={!next}
          onPress={() => next && onChange(next)}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  arrowButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 25, 46, 0.72)',
    borderColor: 'rgba(234, 212, 180, 0.34)',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 0 18px rgba(212, 165, 116, 0.14)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    position: 'absolute',
    width: '100%',
  },
  dial: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  motionRest: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  portalImage: {
    transform: [{ scale: 1.4 }],
  },
  value: {
    fontFamily: FontFamily.displayLight,
    fontSize: 58,
    lineHeight: 68,
    textShadowColor: 'rgba(212, 165, 116, 0.24)',
    textShadowRadius: 14,
  },
  valueCompact: {
    fontSize: 52,
    lineHeight: 62,
  },
  valueRule: {
    backgroundColor: NightTheme.accent,
    borderRadius: 2,
    height: 2,
    marginTop: 14,
    opacity: 0.9,
    width: 26,
  },
  valueStack: {
    alignItems: 'center',
    maxWidth: 220,
  },
});
