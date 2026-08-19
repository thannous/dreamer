import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text } from '@/components/ui';
import { Curve, Duration, StaggerDelayMs } from '@/constants/motion';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { areAccountsEnabled } from '@/lib/env';

/**
 * One beat of the opening: a fade, eased out, offset by its rank. Opacity only
 * — the stagger is what carries the settle, so nothing needs to move. Beats
 * overlap by four fifths, so the five groups read as one wash rather than five
 * arrivals. `ReduceMotion.System` drops the delays too, so a user who asked for
 * less motion gets the screen whole and at once.
 */
const beat = (rank: number) =>
  FadeIn.duration(Duration.slow)
    .easing(Curve.enter)
    .delay(rank * StaggerDelayMs)
    .reduceMotion(ReduceMotion.System);

/**
 * First screen. Immersive atmosphere, one promise, one commitment.
 *
 * It settles in five beats over 1.2 s instead of landing as one block: seen
 * once per install, it is the rare screen where that budget belongs, and the
 * pace is roughly the one the app will later ask the user to breathe at.
 *
 * The sign-in link only exists when accounts are switched on: shipping a
 * sign-in button that leads nowhere is an App Store 2.1 rejection.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen variant="immersive">
      <View testID={TID.Screen.Welcome} className="flex-1 justify-between px-gutter pb-4 pt-16">
        <View className="gap-4">
          <Animated.View entering={beat(0)}>
            <Text variant="overline">{t('welcome.tagline')}</Text>
          </Animated.View>
          <Animated.View entering={beat(1)}>
            <Text variant="display">{t('welcome.title')}</Text>
          </Animated.View>
          <Animated.View entering={beat(2)}>
            <Rule className="self-start" />
          </Animated.View>
        </View>

        <View className="gap-6 pb-6">
          <Animated.View entering={beat(3)}>
            <Text variant="quote">{t('welcome.subtitle')}</Text>
          </Animated.View>

          {/* Both buttons arrive together: the commitment is one beat, not two. */}
          <Animated.View className="gap-3" entering={beat(4)}>
            <Button
              testID={TID.Button.WelcomeStart}
              label={t('welcome.cta')}
              onPress={() => router.push('/goals')}
            />
            {areAccountsEnabled() ? (
              <Button
                label={t('welcome.signin')}
                variant="ghost"
                onPress={() => router.push('/sign-in')}
              />
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Screen>
  );
}
