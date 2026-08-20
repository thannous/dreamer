import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text } from '@/components/ui';
import { Curve, Duration, PressOpacity } from '@/constants/motion';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';

import { StepDots } from './StepDots';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = React.PropsWithChildren<{
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onContinue: () => void;
  /** Continue stays inert until the step has an answer. */
  canContinue?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  /** Maestro anchor for the step, from `TID.Screen`. */
  testID?: string;
}>;

/**
 * Shared frame for every onboarding step: progress, a Fraunces question, the
 * options, then one commitment at the bottom. Same rhythm on all four screens
 * so the flow feels like one movement rather than four pages.
 */
export function OnboardingScreen({
  step,
  totalSteps,
  title,
  subtitle,
  ctaLabel,
  onContinue,
  canContinue = true,
  onSkip,
  skipLabel,
  testID,
  children,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const backPress = useSharedValue(0);
  const largeText = fontScale >= 1.5;

  /**
   * The back link is the only control in this frame that is neither a Button
   * nor a card, and it was the last one still answering the finger with a jump
   * cut. Same ramp as the rest of the kit — 120 ms in, 220 ms out — so a screen
   * that holds all three reads as one hand. Opacity only: a text link has
   * nothing to scale without smearing its glyphs.
   */
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backPress.get(), [0, 1], [1, PressOpacity.link]),
  }));

  const handleBackPressIn = () => {
    backPress.set(withTiming(1, { duration: Duration.instant, easing: Curve.standard }));
  };

  const handleBackPressOut = () => {
    backPress.set(withTiming(0, { duration: Duration.fast, easing: Curve.standard }));
  };

  const footer = (
    <View className="gap-3 px-gutter pb-4 pt-2">
      <Button
        testID={TID.Button.OnboardingContinue}
        label={ctaLabel}
        onPress={onContinue}
        disabled={!canContinue}
      />
      {onSkip ? (
        <Button label={skipLabel ?? t('common.skip')} variant="ghost" onPress={onSkip} />
      ) : null}
    </View>
  );

  return (
    <Screen variant="subtle">
      <View testID={testID} className="flex-1">
        <View className="flex-row items-center justify-between px-gutter pb-2 pt-2">
          {router.canGoBack() ? (
            <AnimatedPressable
              onPress={() => router.back()}
              onPressIn={handleBackPressIn}
              onPressOut={handleBackPressOut}
              accessibilityRole="button"
              hitSlop={12}
              style={backStyle}>
              <Text variant="bodySm" tone="accent">
                {t('common.back')}
              </Text>
            </AnimatedPressable>
          ) : (
            <View />
          )}
          <StepDots current={step} total={totalSteps} />
        </View>

        {/*
          No entrance animation here, on purpose. This frame is shared by four
          routes and remounts on each one, so an `entering` would replay on
          every step — and it would composite against the stack's own fade,
          dissolving through a muddy middle instead of through two clean ones.
          It would also hold back the options, which are the tap targets. The
          motion of this flow lives in that cross-fade and in StepDots instead.
        */}
        <ScrollView
          contentContainerClassName="px-gutter pb-6 pt-6 gap-6"
          showsVerticalScrollIndicator={false}>
          <View className="gap-3">
            <Text variant="h1">{title}</Text>
            <Rule className="self-start" />
            <Text variant="bodySm">{subtitle}</Text>
          </View>

          <View className="gap-3">{children}</View>

          {/* A pinned action steals too much of a small screen once Dynamic
              Type reaches the accessibility sizes. Put it after the choices
              instead: every card can then be read in full before continuing. */}
          {largeText ? footer : null}
        </ScrollView>

        {largeText ? null : footer}
      </View>
    </Screen>
  );
}
