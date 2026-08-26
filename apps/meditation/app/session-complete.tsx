import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { Button, Card, Rule, Text } from '@/components/ui';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { WorldScene } from '@/components/worlds';
import {
  canAccessWorld,
  DEFAULT_WORLD_ID,
  isWorldId,
  WORLD_BY_ID,
} from '@/constants/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
import { useLibrary } from '@/context/LibraryContext';
import { useTranslation } from '@/context/LanguageContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import { TID } from '@/lib/testIDs';
import type { TranslationKey } from '@/lib/i18n';
import { computeStreak, toLocalDay } from '@/lib/streak';
import { isSessionInWorldJourney, journeyStateForWorld } from '@/lib/worldJourneys';

/** The Noctalia journal app, if it is installed; its store page otherwise. */
const NOCTALIA_DEEP_LINK = 'noctalia://record';
const NOCTALIA_STORE = 'https://noctalia.app';

/**
 * End of a session. Quiet by design: a congratulation screen with confetti
 * would undo the twenty minutes that came before it.
 */
export default function SessionCompleteScreen() {
  const { id, worldId: worldParam } = useLocalSearchParams<{
    id: string;
    worldId?: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { world: selectedWorld } = useWorld();
  const { isWorldOwned } = useWorldPurchases();
  const fallbackWorld = canAccessWorld(selectedWorld.id, isWorldOwned)
    ? selectedWorld
    : WORLD_BY_ID[DEFAULT_WORLD_ID];
  const world =
    worldParam && isWorldId(worldParam) && canAccessWorld(worldParam, isWorldOwned)
      ? WORLD_BY_ID[worldParam]
      : fallbackWorld;

  const session = id ? SESSION_BY_ID[id] : undefined;

  // Read once per mount, like the profile does: the streak must not shift
  // under the reader while they look at it.
  const { practiceLog, progress } = useLibrary();
  const [today] = useState(() => toLocalDay(new Date()));
  const streak = useMemo(() => computeStreak(practiceLog, today), [practiceLog, today]);
  const journeyState = journeyStateForWorld(world.id, progress);
  const sessionBelongsToJourney = session
    ? isSessionInWorldJourney(world.id, session.id)
    : false;

  const openNoctalia = async () => {
    // The sibling app may not be installed — fall back to the site rather than
    // failing silently on a dead scheme.
    const supported = await Linking.canOpenURL(NOCTALIA_DEEP_LINK).catch(() => false);
    Linking.openURL(supported ? NOCTALIA_DEEP_LINK : NOCTALIA_STORE).catch(() => {});
  };

  return (
    <WorldScene world={world} artwork="completion" scrimStrength={1.12}>
      <ScrollView
        testID={TID.Screen.SessionComplete}
        contentContainerClassName="flex-grow justify-between px-gutter pb-4 pt-16"
        showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          <PracticeProgress world={world} stage="settle" />
          <Text variant="display">{t('complete.title')}</Text>
          <Rule className="self-start" />
          {session ? (
            <>
              <Text variant="quote">
                {t(`session.${session.id}.title` as TranslationKey)}
              </Text>
              {sessionBelongsToJourney ? (
                <Text variant="bodySm">
                  {t(
                    `world.${world.id}.progress.${journeyState.stageId}` as TranslationKey
                  )}
                </Text>
              ) : null}
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
      </ScrollView>
    </WorldScene>
  );
}
