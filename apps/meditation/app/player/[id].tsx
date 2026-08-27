import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyIllustration } from '@/components/atmosphere/EmptyIllustration';
import { ProgressiveSilence } from '@/components/atmosphere/ProgressiveSilence';
import { PlayerControls } from '@/components/player/PlayerControls';
import { ProgressScrubber } from '@/components/player/ProgressScrubber';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { BackLink, Chip, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds';
import { SESSION_BY_ID } from '@/content/sessions';
import { Atmosphere, Themes } from '@/constants/theme';
import {
  canAccessWorld,
  DEFAULT_WORLD_ID,
  isWorldId,
  WORLD_BY_ID,
} from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { SilenceProvider } from '@/context/SilenceContext';
import { usePlayer } from '@/context/PlayerContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import { FADE_TIMERS, formatTime } from '@/lib/audio';
import type { TranslationKey } from '@/lib/i18n';
import { toMinutes } from '@/lib/library';
import { isSessionIncludedInOwnedWorld } from '@/lib/worldJourneys';

export default function PlayerScreen() {
  const { id, worldId: worldParam } = useLocalSearchParams<{
    id: string;
    worldId?: string;
  }>();
  const { t } = useTranslation();
  const { progress } = useLibrary();
  const { gateForSession, gateForTimer, openPaywall } = useSubscription();
  const player = usePlayer();
  const { world: selectedWorld } = useWorld();
  const { isWorldOwned } = useWorldPurchases();
  const fallbackWorld = canAccessWorld(selectedWorld.id, isWorldOwned)
    ? selectedWorld
    : WORLD_BY_ID[DEFAULT_WORLD_ID];
  const requestedWorld =
    worldParam && isWorldId(worldParam) && canAccessWorld(worldParam, isWorldOwned)
      ? WORLD_BY_ID[worldParam]
      : fallbackWorld;
  const world =
    player.worldId && canAccessWorld(player.worldId, isWorldOwned)
      ? WORLD_BY_ID[player.worldId]
      : requestedWorld;
  const worldColors = Themes[world.appearance];
  const worldAtmosphere = Atmosphere[world.appearance];

  const session = id ? SESSION_BY_ID[id] : undefined;
  const alreadyOpen = player.session?.id === id;
  const startedSessionIdRef = useRef<string | null>(null);

  // Opening the screen starts the session; coming back to it from the mini
  // player must NOT restart what is already playing. A natural finish also
  // releases the handle while this route may still be mounted, and must not
  // immediately reopen the same session.
  useEffect(() => {
    if (!id || !session) return;
    if (alreadyOpen) {
      startedSessionIdRef.current = id;
      return;
    }
    if (startedSessionIdRef.current === id) return;
    if (!isSessionIncludedInOwnedWorld(requestedWorld.id, session.id, isWorldOwned)) {
      const gate = gateForSession(session);
      if (!gate.allowed) {
        openPaywall(gate.reason);
        return;
      }
    }
    startedSessionIdRef.current = id;
    player.open(id, progress[id]?.positionSec ?? 0, requestedWorld.id);
    // `player` is a new object on every position tick and would restart the
    // practice on each one. The stable open boundary is the route session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyOpen, gateForSession, id, isWorldOwned, openPaywall, requestedWorld.id, session]);

  if (!session) {
    return (
      <WorldScene world={world} artwork="trainer" scrimStrength={1.12}>
        <View className="flex-1">
          <BackLink
            label={t('player.close')}
            iconColor={worldColors.accentText}
            fallbackHref="/(drawer)/(tabs)"
            className="px-gutter pt-2"
          />
          <View className="flex-1 items-center justify-center px-gutter">
            <Text variant="h3">{t('search.empty.title')}</Text>
          </View>
        </View>
      </WorldScene>
    );
  }

  const playing = player.status === 'playing';
  const loading = player.status === 'loading';

  if (player.status === 'unavailable') {
    return (
      <WorldScene world={world} artwork="trainer" scrimStrength={1.18}>
        <View className="flex-1">
          <BackLink
            label={t('player.close')}
            iconColor={worldColors.accentText}
            fallbackHref="/(drawer)/(tabs)"
            className="px-gutter pt-2"
          />
          <View
            testID={TID.Screen.PlayerUnavailable}
            className="flex-1 items-center justify-center gap-3 px-gutter">
            <EmptyIllustration
              name="offline"
              lineColor={worldColors.accentText}
              dustColor={worldAtmosphere.star}
            />
            <Text variant="h2" className="text-center">
              {t('player.unavailable.title')}
            </Text>
            <Rule />
            <Text variant="bodySm" className="text-center">
              {t('player.unavailable.subtitle')}
            </Text>
          </View>
        </View>
      </WorldScene>
    );
  }

  return (
    // The selected world is the player artwork. Its dedicated trainer scene is
    // a deeper continuation of the journey card, rather than an unrelated
    // generic video or a second competing illustration.
    <WorldScene world={world} artwork="trainer" scrimStrength={1.18}>
      <SilenceProvider active={playing}>
        <View testID={TID.Screen.Player} className="flex-1">
          {/* The one thing that never withdraws. Everything else on this screen
              can go quiet, but a player with no visible way out is hostile —
              and the artwork, which is most of the screen, belongs to no
              control, so there is nothing obvious left to press. */}
          <View className="px-gutter pt-2" style={{ zIndex: 3 }}>
            <BackLink
              testID={TID.Button.PlayerClose}
              label={t('player.close')}
              iconColor={worldColors.accentText}
              fallbackHref="/(drawer)/(tabs)"
            />
          </View>

          {/* Reserve the centre for the real world scene. It keeps the artwork
              legible on small screens and leaves one obvious touch target when
              progressive silence has withdrawn the non-essential chrome. */}
          <View
            className="flex-1"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />

          {/* The signature: while a session plays, everything but the artwork
              withdraws after a few seconds. One touch brings it back. */}
          <ProgressiveSilence className="max-h-[72%] pb-4">
            <ScrollView
              contentContainerClassName="gap-5 px-gutter pb-4"
              showsVerticalScrollIndicator={false}>
              <PracticeProgress world={world} stage="practice" />
              <View className="gap-1">
                <Text variant="h2">{t(`session.${session.id}.title` as TranslationKey)}</Text>
                <Text variant="bodySm">
                  {t('common.minutes', { count: toMinutes(session.durationSec) })} ·{' '}
                  {t(`category.${session.categorySlug}.name` as TranslationKey)}
                </Text>
              </View>

              <ProgressScrubber
                positionSec={player.positionSec}
                durationSec={player.durationSec}
                onSeek={player.seekTo}
              />

              <PlayerControls
                playing={playing}
                loading={loading}
                onToggle={player.toggle}
                onSkip={player.skip}
                secondaryIconColor={worldColors.accentText}
                primaryIconColor={worldColors.textOnAccent}
              />

              <View className="flex-row pt-2">
                <Chip
                  testID={TID.Button.PlayerSound}
                  accessibilityRole="switch"
                  accessibilityLabel={
                    player.soundEnabled ? t('trainer.sound.on') : t('trainer.sound.off')
                  }
                  accessibilityState={{ checked: player.soundEnabled }}
                  label={player.soundEnabled ? t('trainer.sound.on') : t('trainer.sound.off')}
                  selected={player.soundEnabled}
                  onPress={player.toggleSound}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2">
                <Chip
                  label={t('player.timer.none')}
                  selected={player.fadeMinutes === null}
                  onPress={() => player.setFadeTimer(null)}
                />
                {FADE_TIMERS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={t('player.timer.minutes', { count: minutes })}
                    selected={player.fadeMinutes === minutes}
                    onPress={() => {
                      const gate = gateForTimer(minutes);
                      if (!gate.allowed) {
                        openPaywall(gate.reason);
                        return;
                      }
                      player.setFadeTimer(minutes);
                    }}
                  />
                ))}
              </ScrollView>

              {player.fadeRemainingSec !== null ? (
                <Text variant="caption" className="text-center">
                  {t('player.timer.remaining', { time: formatTime(player.fadeRemainingSec) })}
                </Text>
              ) : null}
            </ScrollView>
          </ProgressiveSilence>
        </View>
      </SilenceProvider>
    </WorldScene>
  );
}
