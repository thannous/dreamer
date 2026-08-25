import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Beat } from '@/components/atmosphere/Beat';
import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { Button, Rule, Text } from '@/components/ui';
import { Duration } from '@/constants/motion';
import { useTranslation } from '@/context/LanguageContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TID } from '@/lib/testIDs';
import { areAccountsEnabled } from '@/lib/env';

const WELCOME_PORTAL = require('@/assets/onboarding/welcome-portal.webp');

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
  const reducedMotion = useReducedMotion();

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <Image
        accessible={false}
        source={WELCOME_PORTAL}
        contentFit="cover"
        contentPosition="center"
        transition={reducedMotion ? 0 : Duration.slow}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(3, 4, 13, 0.7)',
          'rgba(3, 4, 13, 0.08)',
          'rgba(3, 4, 13, 0.14)',
          'rgba(3, 4, 13, 0.78)',
        ]}
        locations={[0, 0.22, 0.66, 1]}
        style={StyleSheet.absoluteFill}
      />
      <GrainOverlay opacity={0.025} />

      <SafeAreaView style={{ flex: 1, zIndex: 1 }}>
        <View testID={TID.Screen.Welcome} className="flex-1 justify-between px-gutter pb-4 pt-10">
          <View className="gap-4">
            <Beat rank={0}>
              <Text variant="overline">{t('welcome.tagline')}</Text>
            </Beat>
            <Beat rank={1}>
              <Text variant="display">{t('welcome.title')}</Text>
            </Beat>
            <Beat rank={2}>
              <Rule className="self-start" />
            </Beat>
          </View>

          <View className="gap-6 pb-3">
            <Beat rank={3}>
              <Text variant="quote">{t('welcome.subtitle')}</Text>
            </Beat>

            {/* Both buttons arrive together: the commitment is one beat, not two. */}
            <Beat rank={4} className="gap-3">
              <Button
                testID={TID.Button.WelcomeStart}
                label={t('welcome.cta')}
                onPress={() => router.push('/breath-intro')}
              />
              {areAccountsEnabled() ? (
                <Button
                  label={t('welcome.signin')}
                  variant="ghost"
                  onPress={() => router.push('/sign-in')}
                />
              ) : null}
            </Beat>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
