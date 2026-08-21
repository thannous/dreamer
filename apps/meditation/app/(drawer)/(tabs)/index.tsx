import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DailyRitualShelf } from '@/components/journey/DailyRitualShelf';
import { WeeklyJourney } from '@/components/journey/WeeklyJourney';
import { Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { WorldSwitcher } from '@/components/worlds/WorldSwitcher';
import { WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useWorld } from '@/context/WorldContext';
import { greetingKey, resumableSession, sessionOfTheDay } from '@/lib/library';
import { toLocalDay } from '@/lib/streak';

const WORLDS = WORLD_IDS.map((worldId) => WORLD_BY_ID[worldId]);

export default function HomeTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const { state } = useOnboarding();
  const { progress, practiceLog } = useLibrary();
  const { world, worldId, setWorld } = useWorld();

  // The recommendation stays stable for the whole visit. Use the local day:
  // a late-night ritual must belong to the evening the listener is living.
  const [now] = useState(() => new Date());
  const today = toLocalDay(now);
  const hour = now.getHours();

  const todaySession = useMemo(() => sessionOfTheDay(today, state.goals), [today, state.goals]);
  const resume = useMemo(() => resumableSession(progress), [progress]);
  const activeSession = resume?.session ?? todaySession;
  const activeProgress = progress[activeSession.id];

  return (
    <WorldScene world={world} artwork="journey" edges={['top']} className="flex-1">
      <ScrollView
        testID={TID.Screen.Home}
        contentContainerClassName="px-gutter pb-4 pt-3"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarInset }}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View className="flex-1 justify-between gap-8">
          <View className="max-w-[78%] gap-2 pr-8">
            <Text variant="overline">{t('home.journey.eyebrow')}</Text>
            <Text variant="display">{t(greetingKey(hour))}</Text>
            <Text variant="bodySm">{t(world.descriptionKey)}</Text>
          </View>

          <View className="gap-5">
            <WorldSwitcher
              worlds={WORLDS}
              selectedWorldId={worldId}
              onSelect={(nextWorldId) => void setWorld(nextWorldId)}
              accessibilityLabel={t('home.journey.worldLabel')}
              testID="home.world-switcher"
            />
            <WeeklyJourney practiceLog={practiceLog} today={today} />
            <DailyRitualShelf
              session={activeSession}
              progress={activeProgress}
              world={world}
              onOpen={() => router.push(`/session/${activeSession.id}`)}
            />
          </View>
        </View>
      </ScrollView>
    </WorldScene>
  );
}
