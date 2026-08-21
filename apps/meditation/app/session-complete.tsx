import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button, Card, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
import { useLibrary } from '@/context/LibraryContext';
import { useTranslation } from '@/context/LanguageContext';
import { useWorld } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { computeStreak, toLocalDay } from '@/lib/streak';

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
  const { world } = useWorld();

  const session = id ? SESSION_BY_ID[id] : undefined;

  // Read once per mount, like the profile does: the streak must not shift
  // under the reader while they look at it.
  const { practiceLog } = useLibrary();
  const [today] = useState(() => toLocalDay(new Date()));
  const streak = useMemo(() => computeStreak(practiceLog, today), [practiceLog, today]);

  const openNoctalia = async () => {
    // The sibling app may not be installed — fall back to the site rather than
    // failing silently on a dead scheme.
    const supported = await Linking.canOpenURL(NOCTALIA_DEEP_LINK).catch(() => false);
    Linking.openURL(supported ? NOCTALIA_DEEP_LINK : NOCTALIA_STORE).catch(() => {});
  };

  return (
    <WorldScene world={world} artwork="completion" scrimStrength={1.12}>
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

          {/* The reason to come back tomorrow. The practice series is the core
              loop of the app, and this is the one moment it has earned. */}
          {streak.current > 0 ? (
            <Text variant="h2" tone="accent">
              {streak.current === 1
                ? t('complete.streak.one')
                : t('complete.streak', { count: streak.current })}
            </Text>
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
    </WorldScene>
  );
}
