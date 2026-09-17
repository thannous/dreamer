import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type PressableProps,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol, Text } from '@/components/ui';
import { Curve, Duration } from '@/constants/motion';
import { NightTheme } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TID } from '@/lib/testIDs';

const DIAL_ARTWORK = require('@/assets/onboarding/reminder/orbital-clock-v1.webp');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  enabled: boolean;
  error?: string;
  enableLabel: string;
  onChangeTime: (value: string) => void;
  onStepTime: (minutes: number) => void;
  onToggle: () => void;
  time: string;
  timeHint: string;
  timeLabel: string;
};

type StepButtonProps = Pick<
  PressableProps,
  'accessibilityLabel' | 'disabled' | 'onPress' | 'testID'
> & {
  direction: 'up' | 'down';
};

function StepButton({ direction, disabled, ...rest }: StepButtonProps) {
  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'chip',
    restOpacity: disabled ? 0.35 : 1,
  });

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={12}
      style={[styles.stepButton, style]}>
      <IconSymbol
        name={direction === 'up' ? 'chevron.up' : 'chevron.down'}
        color={disabled ? NightTheme.textTertiary : NightTheme.accentText}
        size={28}
      />
    </AnimatedPressable>
  );
}

/**
 * A reminder should feel like choosing a point in the evening, not filling in
 * a settings form. The artwork stays still; only the state change answers the
 * user, on the UI thread, and Reduced Motion removes its scale component.
 */
export function ReminderOrbitalClock({
  enabled,
  error,
  enableLabel,
  onChangeTime,
  onStepTime,
  onToggle,
  time,
  timeHint,
  timeLabel,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = useCompactLayout();
  const reducedMotion = useReducedMotion();
  const active = useSharedValue(enabled ? 1 : 0);
  const toggleMotion = usePressMotion({ surface: 'card' });
  const dialSize = Math.min(width - 20, compact ? 340 : 390);

  useEffect(() => {
    active.set(
      reducedMotion
        ? enabled
          ? 1
          : 0
        : withTiming(enabled ? 1 : 0, {
            duration: Duration.fast,
            easing: Curve.standard,
          })
    );
  }, [active, enabled, reducedMotion]);

  const dialStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.get(), [0, 1], [0.48, 1]),
    transform: [
      { scale: reducedMotion ? 1 : interpolate(active.get(), [0, 1], [0.985, 1]) },
    ],
  }));

  const toggleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.get(), [0, 1], [0.72, 1]),
  }));

  return (
    <View className="items-center">
      <Animated.View
        style={[
          styles.dial,
          { borderRadius: dialSize / 2, height: dialSize, width: dialSize },
          dialStyle,
        ]}>
        <Image
          accessible={false}
          source={DIAL_ARTWORK}
          contentFit="contain"
          recyclingKey="onboarding-reminder-orbital-clock"
          style={StyleSheet.absoluteFill}
        />

        <View pointerEvents="box-none" style={styles.timeStack}>
          <StepButton
            testID={TID.Button.ReminderTimeUp}
            direction="up"
            disabled={!enabled}
            onPress={() => onStepTime(15)}
            accessibilityLabel={`${timeLabel}, +15`}
          />

          <Text variant="overline" className="mb-1">
            {timeLabel}
          </Text>
          <TextInput
            testID={TID.Text.ReminderTime}
            accessibilityLabel={timeLabel}
            accessibilityHint={timeHint}
            accessibilityState={{ disabled: !enabled }}
            aria-invalid={!!error}
            allowFontScaling
            maxFontSizeMultiplier={1.35}
            editable={enabled}
            selectTextOnFocus
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            value={time}
            onChangeText={onChangeTime}
            selectionColor={NightTheme.accent}
            style={[styles.timeInput, enabled ? styles.timeEnabled : styles.timeDisabled]}
          />

          <StepButton
            testID={TID.Button.ReminderTimeDown}
            direction="down"
            disabled={!enabled}
            onPress={() => onStepTime(-15)}
            accessibilityLabel={`${timeLabel}, -15`}
          />
        </View>
      </Animated.View>

      <AnimatedPressable
        testID={TID.Option.ReminderEnable}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled }}
        onPress={onToggle}
        onPressIn={toggleMotion.handlePressIn}
        onPressOut={toggleMotion.handlePressOut}
        pressRetentionOffset={12}
        style={[styles.toggle, toggleMotion.style, toggleStyle]}>
        <View style={[styles.check, enabled ? styles.checkEnabled : styles.checkDisabled]}>
          {enabled ? (
            <IconSymbol name="checkmark" color={NightTheme.accentText} size={21} />
          ) : null}
        </View>
        <Text variant="h3" className="flex-1">
          {enableLabel}
        </Text>
        <IconSymbol
          name="bell"
          color={enabled ? NightTheme.accentText : NightTheme.textTertiary}
          size={22}
        />
      </AnimatedPressable>

      {error ? (
        <Text
          variant="caption"
          accessibilityLiveRegion="polite"
          className="mt-2 px-gutter text-center">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  check: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  checkDisabled: {
    borderColor: 'rgba(234, 212, 180, 0.24)',
    borderWidth: 1,
  },
  checkEnabled: {
    backgroundColor: 'rgba(212, 165, 116, 0.06)',
    borderColor: NightTheme.accent,
    borderWidth: 1,
    boxShadow: '0 0 18px rgba(212, 165, 116, 0.34)',
  },
  dial: {
    alignItems: 'center',
    boxShadow: '0 0 30px rgba(212, 165, 116, 0.12)',
    justifyContent: 'center',
    marginTop: 52,
    overflow: 'hidden',
  },
  stepButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 52,
  },
  timeDisabled: {
    color: NightTheme.textTertiary,
  },
  timeEnabled: {
    color: NightTheme.accentText,
    textShadowColor: 'rgba(212, 165, 116, 0.30)',
    textShadowRadius: 16,
  },
  timeInput: {
    fontFamily: FontFamily.displayLight,
    fontSize: 52,
    lineHeight: 62,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'center',
    width: 220,
  },
  timeStack: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  toggle: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 40, 0.48)',
    borderColor: 'rgba(212, 165, 116, 0.46)',
    borderRadius: 34,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: -8,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 244,
    width: '62%',
  },
});
