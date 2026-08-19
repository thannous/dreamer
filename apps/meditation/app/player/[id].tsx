import { useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { ProgressiveSilence } from '@/components/atmosphere/ProgressiveSilence';
import { Screen } from '@/components/atmosphere/Screen';
import { PlayerControls } from '@/components/player/PlayerControls';
import { ProgressScrubber } from '@/components/player/ProgressScrubber';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { BackLink, Chip, Rule, Text } from '@/components/ui';
import { AMBIENCES } from '@/content/ambiences';
import { NARRATOR_BY_ID } from '@/content/narrators';
import { SESSION_BY_ID } from '@/content/sessions';
import { useTranslation } from '@/context/LanguageContext';
import { useLibrary } from '@/context/LibraryContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePlayer } from '@/context/PlayerContext';
import { FADE_TIMERS, formatTime, PLAYBACK_RATES } from '@/lib/audio';
import type { TranslationKey } from '@/lib/i18n';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { progress } = useLibrary();
  const { gateForTimer, openPaywall } = useSubscription();
  const player = usePlayer();

  const session = id ? SESSION_BY_ID[id] : undefined;
  const alreadyOpen = player.session?.id === id;

  // Opening the screen starts the session; coming back to it from the mini
  // player must NOT restart what is already playing.
  useEffect(() => {
    if (!id || alreadyOpen) return;
    player.open(id, progress[id]?.positionSec ?? 0);
    // Intentionally keyed on the session alone: `player` is a new object on
    // every position tick and would restart playback on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, alreadyOpen]);

  if (!session) {
    return (
      <Screen variant="immersive">
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="h3">{t('search.empty.title')}</Text>
        </View>
      </Screen>
    );
  }

  const playing = player.status === 'playing';
  const narrator = NARRATOR_BY_ID[session.narratorId];

  if (player.status === 'unavailable') {
    return (
      <Screen variant="immersive">
        <BackLink label={t('player.close')} className="px-gutter pt-2" />
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text variant="h2" className="text-center">
            {t('player.unavailable.title')}
          </Text>
          <Rule />
          <Text variant="bodySm" className="text-center">
            {t('player.unavailable.subtitle')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="immersive">
      <View className="flex-1">
        <ProgressiveSilence active={playing} className="px-gutter pt-2">
          <BackLink label={t('player.close')} fallbackHref="/(tabs)" />
        </ProgressiveSilence>

        <View className="flex-1 justify-center px-gutter">
          <SessionArtwork accent={session.accent} rounded="artwork" className="aspect-square" />
        </View>

        {/* The signature: while a session plays, everything but the artwork
            withdraws after a few seconds. One touch brings it back. */}
        <ProgressiveSilence active={playing} className="gap-5 px-gutter pb-4">
          <View className="gap-1">
            <Text variant="h2">{t(`session.${session.id}.title` as TranslationKey)}</Text>
            <Text variant="bodySm">
              {session.narratorId === 'wordless'
                ? t('session.narrator.wordless')
                : `${t('session.narrator')} ${narrator.name}`}
            </Text>
          </View>

          <ProgressScrubber
            positionSec={player.positionSec}
            durationSec={player.durationSec}
            onSeek={player.seekTo}
          />

          <PlayerControls playing={playing} onToggle={player.toggle} onSkip={player.skip} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pt-2">
            {PLAYBACK_RATES.map((rate) => (
              <Chip
                key={rate}
                label={`${rate}×`}
                selected={player.rate === rate}
                onPress={() => player.setRate(rate)}
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2">
            {AMBIENCES.map((ambience) => (
              <Chip
                key={ambience.id}
                label={t(`player.ambience.${ambience.id}` as TranslationKey)}
                selected={player.ambienceId === ambience.id}
                onPress={() => player.setAmbience(ambience.id)}
              />
            ))}
          </ScrollView>

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
        </ProgressiveSilence>
      </View>
    </Screen>
  );
}
