import { useIsFocused, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { DailyRitualShelf } from '@/components/journey/DailyRitualShelf';
import { UpcomingJourneyRail } from '@/components/journey/UpcomingJourneyRail';
import { WeeklyJourney } from '@/components/journey/WeeklyJourney';
import { WorldJourneyPicker } from '@/components/journey/WorldJourneyPicker';
import { WorldPreviewShelf } from '@/components/journey/WorldPreviewShelf';
import { Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { DEFAULT_WORLD_ID, WORLD_BY_ID, WORLD_IDS, type WorldId } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import type { TranslationKey } from '@/lib/i18n';
import type { MeditationSession } from '@/lib/types';
import { greetingKey, toMinutes } from '@/lib/library';
import { toLocalDay } from '@/lib/streak';
import { TID } from '@/lib/testIDs';
import {
  homeRecommendationForWorld,
  resumableSessionForWorld,
  isSessionIncludedInOwnedWorld,
  upcomingSessionsForWorld,
} from '@/lib/worldJourneys';

const WORLDS = WORLD_IDS.map((worldId) => WORLD_BY_ID[worldId]);
const SHORT_VIEWPORT_HEIGHT = 700;

export default function HomeTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const { width, height, fontScale } = useWindowDimensions();
  const compactViewport = height < SHORT_VIEWPORT_HEIGHT || fontScale > 1.15;
  const narrowViewport = width < 375;
  const { progress, practiceLog } = useLibrary();
  const { state: onboarding } = useOnboarding();
  const { gateForSession, openPaywall, remainingPlays, quotaResetDay, isPlus } = useSubscription();
  const {
    worldId,
    previewWorldId,
    presentationWorldId,
    presentationWorld,
    setWorld,
    setPreviewWorld,
  } = useWorld();
  const { loaded: worldPurchasesLoaded, isWorldOwned, offerForWorld } = useWorldPurchases();
  const focused = useIsFocused();
  const selectedWorldId = isWorldOwned(worldId) ? worldId : DEFAULT_WORLD_ID;
  const activeWorldId = presentationWorldId;
  const world = presentationWorld;

  useEffect(() => {
    if (worldPurchasesLoaded && !previewWorldId && worldId !== selectedWorldId) {
      void setWorld(selectedWorldId);
    }
  }, [previewWorldId, selectedWorldId, setWorld, worldId, worldPurchasesLoaded]);

  useEffect(() => {
    if (!focused && previewWorldId) {
      setPreviewWorld(null);
    }
  }, [focused, previewWorldId, setPreviewWorld]);

  // The recommendation stays stable for the whole visit. Use the local day:
  // a late-night ritual must belong to the evening the listener is living.
  const [now] = useState(() => new Date());
  const today = toLocalDay(now);
  const hour = now.getHours();

  const isPlayable = useCallback(
    (session: MeditationSession) => {
      if (isSessionIncludedInOwnedWorld(activeWorldId, session.id, isWorldOwned)) {
        return true;
      }
      return gateForSession(session).allowed;
    },
    [activeWorldId, gateForSession, isWorldOwned]
  );
  const recommendationPreference = useMemo(
    () => ({
      goals: onboarding.goals,
      dailyIntentionMin: onboarding.dailyIntentionMin,
      lockToWorld: world.access === 'purchase' && isWorldOwned(activeWorldId),
    }),
    [activeWorldId, isWorldOwned, onboarding.dailyIntentionMin, onboarding.goals, world.access]
  );
  const recommendation = useMemo(
    () =>
      homeRecommendationForWorld(
        activeWorldId,
        today,
        progress,
        isPlayable,
        recommendationPreference
      ),
    [activeWorldId, isPlayable, progress, recommendationPreference, today]
  );
  const todaySession = recommendation.session;
  const resume = useMemo(
    () => resumableSessionForWorld(activeWorldId, progress),
    [activeWorldId, progress]
  );
  const activeSession = resume?.session ?? todaySession;
  const activeProgress = progress[activeSession.id];
  const upcoming = useMemo(
    () => upcomingSessionsForWorld(activeWorldId, activeSession.id, progress),
    [activeSession.id, activeWorldId, progress]
  );

  const openActive = useCallback(
    (shouldResume: boolean) => {
      if (!isSessionIncludedInOwnedWorld(activeWorldId, activeSession.id, isWorldOwned)) {
        const gate = gateForSession(activeSession);
        if (!gate.allowed) {
          openPaywall(gate.reason);
          return;
        }
      }

      router.push(
        shouldResume
          ? `/player/${activeSession.id}?worldId=${activeWorldId}`
          : `/session/${activeSession.id}?worldId=${activeWorldId}`
      );
    },
    [activeSession, activeWorldId, gateForSession, isWorldOwned, openPaywall, router]
  );

  const handleSelectWorld = useCallback(
    (nextWorldId: WorldId) => {
      if (!isWorldOwned(nextWorldId)) {
        setPreviewWorld(nextWorldId);
        return;
      }

      void setWorld(nextWorldId);
    },
    [isWorldOwned, setPreviewWorld, setWorld]
  );

  const handlePreviewWorld = useCallback(
    (nextWorldId: WorldId) => {
      router.push(`/world/${nextWorldId}`);
    },
    [router]
  );
  const worldLocked = world.access === 'purchase' && !isWorldOwned(activeWorldId);
  const worldPrice = offerForWorld(activeWorldId)?.priceLabel ?? '0,99 €';

  return (
    <WorldScene
      world={world}
      artwork="journey"
      edges={['top']}
      className="flex-1">
      <ScrollView
        testID={TID.Screen.Home}
        contentContainerClassName="px-gutter pb-4 pt-3"
        contentContainerStyle={{ paddingBottom: tabBarInset }}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View
          className={
            narrowViewport
              ? 'max-w-[90%] gap-1'
              : compactViewport
                ? 'max-w-[82%] gap-1 pr-8'
                : 'max-w-[78%] gap-2 pr-8'
          }>
          <Text variant="overline">{t(world.nameKey)}</Text>
          <Text variant={narrowViewport ? 'h2' : compactViewport ? 'h1' : 'display'}>
            {t(greetingKey(hour))}
          </Text>
          <Text
            variant="bodySm"
            testID="home.journey.reason">
            {resume
              ? t('home.resume.title')
              : recommendation.reason === 'goal-duration' && recommendation.matchedGoal
                ? t('home.recommended.because.goalDuration', {
                    goal: t(`onboarding.goals.${recommendation.matchedGoal}` as TranslationKey),
                    count: toMinutes(recommendation.session.durationSec),
                  })
                : recommendation.reason === 'goal' && recommendation.matchedGoal
                  ? t('home.recommended.because.goal', {
                      goal: t(`onboarding.goals.${recommendation.matchedGoal}` as TranslationKey),
                    })
                  : recommendation.reason === 'duration' && onboarding.dailyIntentionMin
                    ? t('home.recommended.because.duration', {
                        count: onboarding.dailyIntentionMin,
                      })
                    : t(`world.${world.id}.role` as TranslationKey)}
          </Text>
        </View>

        <View
          className={compactViewport ? 'mt-4 gap-3' : 'mt-5 gap-3'}
          testID="home.journey.deck">
          <WorldJourneyPicker
            worlds={WORLDS}
            selectedWorldId={selectedWorldId}
            previewedWorldId={previewWorldId}
            onSelect={handleSelectWorld}
            isWorldOwned={isWorldOwned}
            priceForWorld={(nextWorldId) => offerForWorld(nextWorldId)?.priceLabel}
            accessibilityLabel={t('home.journey.worldLabel')}
            testID="home.world-switcher"
          />
          {worldLocked ? (
            <WorldPreviewShelf
              world={world}
              priceLabel={worldPrice}
              onPreview={() => handlePreviewWorld(activeWorldId)}
            />
          ) : (
            <DailyRitualShelf
              world={world}
              session={activeSession}
              sessionProgress={activeProgress}
              journeyProgress={progress}
              recommendationSource={resume ? 'world' : recommendation.source}
              isSessionIncluded={(sessionId) =>
                isSessionIncludedInOwnedWorld(activeWorldId, sessionId, isWorldOwned)
              }
              accessGate={gateForSession(activeSession)}
              remainingPlays={remainingPlays}
              quotaResetDay={quotaResetDay}
              isPlus={isPlus}
              onOpen={openActive}
              onOpenPaywall={openPaywall}
              onOpenAlternative={() => router.push('/breathe')}
            />
          )}
        </View>

        <View className={compactViewport ? 'mt-4' : 'mt-6'} testID="home.journey.week">
          <WeeklyJourney practiceLog={practiceLog} today={today} />
        </View>

        {!worldLocked ? (
          <View className={compactViewport ? 'mt-4' : 'mt-5'}>
            <UpcomingJourneyRail
              sessions={upcoming}
              appearance={world.appearance}
              isSessionIncluded={(sessionId) =>
                isSessionIncludedInOwnedWorld(activeWorldId, sessionId, isWorldOwned)
              }
              accessForSession={(session) =>
                isSessionIncludedInOwnedWorld(activeWorldId, session.id, isWorldOwned)
                  ? { allowed: true }
                  : gateForSession(session)
              }
              onOpen={(sessionId) =>
                router.push(`/session/${sessionId}?worldId=${activeWorldId}`)
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </WorldScene>
  );
}
