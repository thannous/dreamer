import { useIsFocused, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { DailyRitualShelf } from '@/components/journey/DailyRitualShelf';
import { UpcomingJourneyRail } from '@/components/journey/UpcomingJourneyRail';
import { WeeklyJourney } from '@/components/journey/WeeklyJourney';
import { WorldJourneyPicker } from '@/components/journey/WorldJourneyPicker';
import { WorldPreviewShelf } from '@/components/journey/WorldPreviewShelf';
import { Button, Card, Text } from '@/components/ui';
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
  const {
    gateForSession,
    openPaywall,
    remainingPlays,
    quotaResetDay,
    isPlus,
    subscriptionsEnabled = true,
  } = useSubscription();
  const {
    loaded: worldLoaded,
    worldId,
    previewWorldId,
    presentationWorldId,
    presentationWorld,
    setWorld,
    setPreviewWorld,
  } = useWorld();
  const {
    ownershipStatus,
    offersStatus,
    isWorldOwned,
    worldAccess,
    offerForWorld,
    retryOwnership,
    retryOffers,
    restoreWorlds,
  } = useWorldPurchases();
  const resolveWorldAccess = useMemo(
    () =>
      typeof worldAccess === 'function'
        ? worldAccess
        : (nextWorldId: WorldId) => (isWorldOwned(nextWorldId) ? 'owned' : 'not-owned'),
    [isWorldOwned, worldAccess]
  );
  const focused = useIsFocused();
  const selectedWorldAccess = resolveWorldAccess(worldId);
  const selectedWorldId = selectedWorldAccess === 'not-owned' ? DEFAULT_WORLD_ID : worldId;
  const activeWorldId = presentationWorldId;
  const world = presentationWorld;
  const [worldRecoveryBusy, setWorldRecoveryBusy] = useState(false);
  const [worldRecoveryMessage, setWorldRecoveryMessage] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (
      ownershipStatus === 'ready' &&
      selectedWorldAccess === 'not-owned' &&
      !previewWorldId &&
      worldId !== selectedWorldId
    ) {
      void setWorld(selectedWorldId);
    }
  }, [ownershipStatus, previewWorldId, selectedWorldAccess, selectedWorldId, setWorld, worldId]);

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
      if (!subscriptionsEnabled) {
        return true;
      }
      if (isSessionIncludedInOwnedWorld(activeWorldId, session.id, isWorldOwned)) {
        return true;
      }
      return gateForSession(session).allowed;
    },
    [activeWorldId, gateForSession, isWorldOwned, subscriptionsEnabled]
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
      if (
        subscriptionsEnabled &&
        !isSessionIncludedInOwnedWorld(activeWorldId, activeSession.id, isWorldOwned)
      ) {
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
    [
      activeSession,
      activeWorldId,
      gateForSession,
      isWorldOwned,
      openPaywall,
      router,
      subscriptionsEnabled,
    ]
  );

  const handleSelectWorld = useCallback(
    (nextWorldId: WorldId) => {
      const nextAccess = resolveWorldAccess(nextWorldId);
      if (nextAccess !== 'free' && nextAccess !== 'owned') {
        setPreviewWorld(nextWorldId);
        return;
      }

      void setWorld(nextWorldId);
    },
    [resolveWorldAccess, setPreviewWorld, setWorld]
  );

  const handlePreviewWorld = useCallback(
    (nextWorldId: WorldId) => {
      router.push(`/world/${nextWorldId}`);
    },
    [router]
  );
  const activeWorldAccess = resolveWorldAccess(activeWorldId);
  const worldLocked = world.access === 'purchase' && activeWorldAccess === 'not-owned';
  const worldAccessUnknown = world.access === 'purchase' && activeWorldAccess === 'unknown';
  const worldOffer = offerForWorld(activeWorldId);

  const handleRetryWorldAccess = useCallback(async () => {
    setWorldRecoveryBusy(true);
    setWorldRecoveryMessage(null);
    try {
      await retryOwnership();
    } finally {
      setWorldRecoveryBusy(false);
    }
  }, [retryOwnership]);

  const handleRestoreWorldAccess = useCallback(async () => {
    setWorldRecoveryBusy(true);
    setWorldRecoveryMessage(null);
    try {
      const restored = await restoreWorlds();
      if (!restored.includes(activeWorldId)) {
        setWorldRecoveryMessage('world.purchase.restore.empty');
      }
    } catch {
      setWorldRecoveryMessage('world.purchase.error');
    } finally {
      setWorldRecoveryBusy(false);
    }
  }, [activeWorldId, restoreWorlds]);

  const handleRetryWorldOffer = useCallback(async () => {
    setWorldRecoveryBusy(true);
    setWorldRecoveryMessage(null);
    try {
      await retryOffers();
    } finally {
      setWorldRecoveryBusy(false);
    }
  }, [retryOffers]);

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
            worldAccess={resolveWorldAccess}
            offersStatus={offersStatus}
            priceForWorld={(nextWorldId) => offerForWorld(nextWorldId)?.priceLabel}
            initialSelectionReady={worldLoaded && ownershipStatus !== 'loading'}
            accessibilityLabel={t('home.journey.worldLabel')}
            testID="home.world-switcher"
          />
          {worldAccessUnknown ? (
            <Card
              accessibilityLiveRegion="polite"
              testID="home.world-access-recovery">
              <View className="gap-3">
                <Text variant="h3">{t('world.purchase.access.title')}</Text>
                <Text variant="bodySm" tone="muted">
                  {t(
                    ownershipStatus === 'loading'
                      ? 'world.purchase.access.checking'
                      : 'world.purchase.access.unavailable'
                  )}
                </Text>
                <View className="gap-2">
                  <Button
                    label={t('world.purchase.access.retry')}
                    variant="secondary"
                    loading={worldRecoveryBusy && ownershipStatus === 'loading'}
                    disabled={worldRecoveryBusy}
                    onPress={() => void handleRetryWorldAccess()}
                  />
                  <Button
                    label={t('world.purchase.restore')}
                    variant="ghost"
                    disabled={worldRecoveryBusy}
                    onPress={() => void handleRestoreWorldAccess()}
                  />
                </View>
                {worldRecoveryMessage ? (
                  <Text variant="caption" tone="muted">
                    {t(worldRecoveryMessage)}
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : worldLocked && !worldOffer ? (
            <Card
              accessibilityLiveRegion="polite"
              testID="home.world-offer-recovery">
              <View className="gap-3">
                <Text variant="h3">
                  {t(
                    offersStatus === 'loading'
                      ? 'world.purchase.offer.checking'
                      : 'world.purchase.offer.unavailable'
                  )}
                </Text>
                <Button
                  label={t('world.purchase.offer.retry')}
                  variant="secondary"
                  loading={worldRecoveryBusy && offersStatus === 'loading'}
                  disabled={worldRecoveryBusy || offersStatus === 'loading'}
                  onPress={() => void handleRetryWorldOffer()}
                />
                <Button
                  label={t('world.purchase.restore')}
                  variant="ghost"
                  disabled={worldRecoveryBusy}
                  onPress={() => void handleRestoreWorldAccess()}
                />
                {worldRecoveryMessage ? (
                  <Text variant="caption" tone="muted">
                    {t(worldRecoveryMessage)}
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : worldLocked && worldOffer ? (
            <WorldPreviewShelf
              world={world}
              priceLabel={worldOffer.priceLabel}
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
              accessGate={
                subscriptionsEnabled ? gateForSession(activeSession) : { allowed: true }
              }
              remainingPlays={remainingPlays}
              quotaResetDay={quotaResetDay}
              isPlus={isPlus}
              subscriptionsEnabled={subscriptionsEnabled}
              onOpen={openActive}
              onOpenPaywall={openPaywall}
              onOpenAlternative={() => router.push('/breathe')}
            />
          )}
        </View>

        <View className={compactViewport ? 'mt-4' : 'mt-6'} testID="home.journey.week">
          <WeeklyJourney practiceLog={practiceLog} today={today} />
        </View>

        {!worldLocked && !worldAccessUnknown ? (
          <View className={compactViewport ? 'mt-4' : 'mt-5'}>
            <UpcomingJourneyRail
              sessions={upcoming}
              appearance={world.appearance}
              isSessionIncluded={(sessionId) =>
                isSessionIncludedInOwnedWorld(activeWorldId, sessionId, isWorldOwned)
              }
              accessForSession={(session) =>
                !subscriptionsEnabled ||
                isSessionIncludedInOwnedWorld(activeWorldId, session.id, isWorldOwned)
                  ? { allowed: true }
                  : gateForSession(session)
              }
              subscriptionsEnabled={subscriptionsEnabled}
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
