import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { InteractiveBreathHalo } from '@/components/onboarding/InteractiveBreathHalo';
import { Button, IconSymbol, Rule, Text } from '@/components/ui';
import { NightTheme } from '@/constants/theme';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';

export default function BreathIntroStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <Screen variant="immersive">
      <View testID={TID.Screen.OnboardingBreathIntro} className="flex-1 px-gutter pb-4 pt-7">
        <View className="gap-3">
          <Text variant="overline">{t('welcome.tagline')}</Text>
          <Text variant="display">{t('onboarding.breathIntro.title')}</Text>
          <Rule className="self-start" />
        </View>

        <View className="flex-1 items-center justify-around py-2">
          <InteractiveBreathHalo soundEnabled={soundEnabled} />

          <Pressable
            testID={TID.Button.BreathIntroSound}
            accessibilityRole="switch"
            accessibilityLabel={t(
              soundEnabled
                ? 'onboarding.breathIntro.soundOn'
                : 'onboarding.breathIntro.soundOff'
            )}
            accessibilityState={{ checked: soundEnabled }}
            hitSlop={10}
            pressRetentionOffset={12}
            onPress={() => setSoundEnabled((current) => !current)}
            className="min-h-12 items-center justify-center gap-1 px-4">
            <IconSymbol
              name={soundEnabled ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
              color={NightTheme.accent}
              size={42}
            />
            <Text variant="bodySm" className="text-center">
              {t(
                soundEnabled
                  ? 'onboarding.breathIntro.soundOn'
                  : 'onboarding.breathIntro.soundOff'
              )}
            </Text>
          </Pressable>
        </View>

        <View className="gap-5">
          <Text variant="quote">{t('welcome.subtitle')}</Text>
          <Button
            testID={TID.Button.OnboardingContinue}
            label={t('common.continue')}
            onPress={() => router.push('/goals')}
          />
        </View>
      </View>
    </Screen>
  );
}
