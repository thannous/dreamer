import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Beat } from '@/components/atmosphere/Beat';
import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { areAccountsEnabled } from '@/lib/env';

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
    <Screen variant="immersive" video="welcome">
      <View testID={TID.Screen.Welcome} className="flex-1 justify-between px-gutter pb-4 pt-16">
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

        <View className="gap-6 pb-6">
          <Beat rank={3}>
            <Text variant="quote">{t('welcome.subtitle')}</Text>
          </Beat>

          {/* Both buttons arrive together: the commitment is one beat, not two. */}
          <Beat rank={4} className="gap-3">
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
          </Beat>
        </View>
      </View>
    </Screen>
  );
}
