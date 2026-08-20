import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Card, Rule, Text } from '@/components/ui';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';

/** The Noctalia journal app, if it is installed; its store page otherwise. */
const NOCTALIA_DEEP_LINK = 'noctalia://record';
const NOCTALIA_STORE = 'https://noctalia.app';

/**
 * End of a session. Quiet by design: a congratulation screen with confetti
 * would undo the twenty minutes that came before it.
 */
export default function SessionCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const session = id ? SESSION_BY_ID[id] : undefined;

  const openNoctalia = async () => {
    // The sibling app may not be installed — fall back to the site rather than
    // failing silently on a dead scheme.
    const supported = await Linking.canOpenURL(NOCTALIA_DEEP_LINK).catch(() => false);
    Linking.openURL(supported ? NOCTALIA_DEEP_LINK : NOCTALIA_STORE).catch(() => {});
  };

  return (
    <Screen variant="immersive" video="sleep">
      <View testID={TID.Screen.SessionComplete} className="flex-1 justify-between px-gutter pb-4 pt-16">
        <View className="gap-4">
          <Text variant="display">{t('complete.title')}</Text>
          <Rule className="self-start" />
          {session ? (
            <>
              <Text variant="quote">
                {t(`session.${session.id}.title` as TranslationKey)}
              </Text>
              <Text variant="bodySm">
                {t('complete.minutes', { count: toMinutes(session.durationSec) })}
              </Text>
            </>
          ) : null}
        </View>

        <View className="gap-4 pb-4">
          {session?.categorySlug === 'dream-prep' ? (
            <Card featured>
              <Text variant="h3">{t('complete.dream.title')}</Text>
              <Button
                label={t('complete.dream.cta')}
                variant="secondary"
                className="mt-4"
                onPress={openNoctalia}
              />
            </Card>
          ) : null}

          <Button label={t('complete.done')} onPress={() => router.replace('/(drawer)/(tabs)')} />
        </View>
      </View>
    </Screen>
  );
}
