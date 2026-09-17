import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BackLink, Button, Card, Chip, Rule, Text, TextField } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/lib/i18n';
import {
  DAILY_INTENTIONS,
  PRACTICE_GOALS,
  type DailyIntention,
} from '@/lib/types';
import { clearAll } from '@/services/storageService';

export default function AccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, setProfile } = useSettings();
  const { state, update, reset } = useOnboarding();
  const [name, setName] = useState(profile.displayName);

  const pickPhoto = async () => {
    // No permission prompt needed for the modern picker: the OS sheet hands
    // back a single image without granting library access.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await setProfile({ avatarUri: result.assets[0].uri });
    }
  };

  const eraseEverything = () => {
    Alert.alert(t('account.reset.confirm'), t('account.reset.body'), [
      { text: t('account.reset.cancel'), style: 'cancel' },
      {
        text: t('account.reset.confirmed'),
        style: 'destructive',
        onPress: async () => {
          await clearAll();
          await reset();
          router.replace('/welcome');
        },
      },
    ]);
  };

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        contentContainerClassName="px-gutter pb-16 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('account.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('account.subtitle')}</Text>
        </View>

        <Card>
          <Text variant="overline">{t('account.photo')}</Text>
          <View className="mt-4 flex-row items-center gap-4">
            <View className="h-16 w-16 overflow-hidden rounded-full border border-hairline bg-ink-panel">
              {profile.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={{ flex: 1 }} contentFit="cover" />
              ) : null}
            </View>
            <View className="flex-1 gap-2">
              <Button label={t('account.photo.choose')} variant="secondary" onPress={pickPhoto} />
              {profile.avatarUri ? (
                <Button
                  label={t('account.photo.remove')}
                  variant="ghost"
                  onPress={() => setProfile({ avatarUri: null })}
                />
              ) : null}
            </View>
          </View>
        </Card>

        <TextField
          label={t('account.name')}
          value={name}
          onChangeText={setName}
          onBlur={() => setProfile({ displayName: name.trim() })}
          placeholder={t('account.name.placeholder')}
          autoCapitalize="words"
        />

        <View className="gap-3">
          <Text variant="overline">{t('account.goals')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRACTICE_GOALS.map((goal) => (
              <Chip
                key={goal}
                label={t(`onboarding.goals.${goal}` as TranslationKey)}
                selected={state.goals.includes(goal)}
                accessibilityLabel={t(`onboarding.goals.${goal}` as TranslationKey)}
                onPress={() => {
                  void update((current) => ({
                    goals: current.goals.includes(goal)
                      ? current.goals.filter((item) => item !== goal)
                      : [...current.goals, goal],
                  }));
                }}
              />
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text variant="overline">{t('onboarding.intention.title')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {DAILY_INTENTIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={t('onboarding.intention.minutes', { count: minutes })}
                selected={state.dailyIntentionMin === minutes}
                accessibilityLabel={t('onboarding.intention.minutes', { count: minutes })}
                onPress={() => {
                  void update({ dailyIntentionMin: minutes as DailyIntention });
                }}
              />
            ))}
          </View>
        </View>

        <Button label={t('account.reset')} variant="ghost" onPress={eraseEverything} />
      </ScrollView>
    </Screen>
  );
}
