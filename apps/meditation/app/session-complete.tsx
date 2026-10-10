import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScopedTheme } from 'uniwind';

import { Button, Card, Text } from '@/components/ui';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { PaperTheme } from '@/constants/theme';
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
import { toMinutes } from '@/lib/library';
import { isSessionInWorldJourney, journeyStateForWorld } from '@/lib/worldJourneys';

/** The Noctalia journal app, if it is installed; its store page otherwise. */
const NOCTALIA_DEEP_LINK = 'noctalia://record';
const NOCTALIA_STORE = 'https://noctalia.app';

/** Paper ground with its transparent twin, for the night-to-paper fade. */
const PAPER = PaperTheme.background;
const PAPER_CLEAR = `${PAPER}00`;

/**
 * End of a session, and the one daylight moment of the practice: the world's
 * night stays at the top and dissolves into paper, the way the landing turns to
 * ivory at waking. Quiet by design: a congratulation screen with confetti would
 * undo the twenty minutes that came before it.
 */
export default function SessionCompleteScreen() {
  const { id, worldId: worldParam } = useLocalSearchParams<{
    id: string;
    worldId?: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
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

  const { progress } = useLibrary();
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

  const record: { key: string; label: string; value: string }[] = session
    ? [
        { key: 'world', label: t('complete.record.world'), value: t(world.nameKey) },
        {
          key: 'duration',
          label: t('complete.record.duration'),
          value: t('home.journey.minutes', { count: toMinutes(session.durationSec) }),
        },
        {
          key: 'session',
          label: t('complete.record.session'),
          value: t(`session.${session.id}.title` as TranslationKey),
        },
        {
          key: 'category',
          label: t('complete.record.category'),
          value: t(`category.${session.categorySlug}.name` as TranslationKey),
        },
      ]
    : [];

  return (
    <ScopedTheme theme="light">
      <StatusBar style="dark" />
      <View className="flex-1 bg-ink">
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          <ScrollView
            testID={TID.Screen.SessionComplete}
            contentContainerClassName="flex-grow justify-between px-gutter pb-4 pt-4"
            showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <PracticeProgress world={{ ...world, appearance: 'light' }} stage="settle" />
              {/* The night the listener leaves, as a band that dissolves into
                  paper. No copy ever sits on it: its contrast depends on the world. */}
              <View
                accessible={false}
                className="-mx-gutter overflow-hidden"
                style={{ height: Math.round(height * 0.26) }}>
                <Image
                  accessible={false}
                  source={world.artwork.completion as ImageProps['source']}
                  contentFit="cover"
                  recyclingKey={`${world.id}-completion`}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[PAPER, PAPER_CLEAR, PAPER_CLEAR, PAPER]}
                  locations={[0, 0.22, 0.6, 1]}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Text variant="saga" accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                {t('complete.title')}
              </Text>
              <Text variant="quote" testID="complete.rest">
                {t('complete.rest')}
              </Text>
              {record.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap border-t border-hairline" testID="complete.record">
                  {record.map((item) => (
                    <View key={item.key} className="w-1/2 gap-1 border-b border-hairline py-3 pr-3">
                      <Text variant="overline">{item.label}</Text>
                      <Text variant="bodySm" tone="default">
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {session && sessionBelongsToJourney ? (
                <Text variant="bodySm">
                  {t(`world.${world.id}.progress.${journeyState.stageId}` as TranslationKey)}
                </Text>
              ) : null}
              <Text variant="caption" tone="muted" testID="complete.saved">
                {t('complete.saved')}
              </Text>
            </View>

            <View className="gap-4 pb-4 pt-6">
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

              <Button
                testID="btn.complete.home"
                label={t('complete.home')}
                onPress={() => router.replace('/(drawer)/(tabs)')}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </ScopedTheme>
  );
}
