import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { memo, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { badgeNewCardsText } from '@/components/badges/badgeCopy';
import { CollectionFan, COLLECTION_ROUTE } from '@/components/badges/CollectionEntry';
import { PressableScale } from '@/components/motion';
import { getDreamerArtwork } from '@/constants/dreamerArtwork';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamGuideCopy } from '@/lib/dreamGuideCopy';
import type { DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import type { RitualId } from '@/lib/inspirationRituals';
import { getSleepSoundCopy } from '@/lib/sleepSoundCopy';
import { useBadgeSummary } from '@/hooks/useBadgeSummary';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { TID } from '@/lib/testIDs';
import { getSymbolById } from '@/services/symbolDictionaryService';

// Each tile's words sit on a night veil over its painting, whatever the theme.
const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');
const IMAGE_FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const;
// A night ground under the painting: the words stay legible while it loads, or offline.
const TILE = { width: 148, height: 184, backgroundColor: NIGHT.surface.raised } as const;
const NIGHT_GROUND = NIGHT.screen.background;
const VEIL = [`${NIGHT_GROUND}00`, `${NIGHT_GROUND}99`, `${NIGHT_GROUND}E0`, `${NIGHT_GROUND}F2`] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// Dedicated portrait paintings keep each door recognizable across themes:
// an amber lantern, a teal waterfall and a violet dream book.
const DISCOVER_ARTWORK = {
  ritual: require('@/assets/images/dreamer/discover/ritual-v2.webp'),
  sleep: require('@/assets/images/dreamer/discover/sleep-v2.webp'),
  guides: require('@/assets/images/dreamer/discover/guides-v2.webp'),
} as const;

// Gentle symbols most dreamers share: Today greets a sleepy reader, never with a nightmare.
const DAILY_SYMBOLS = [
  'moon', 'stars', 'sky', 'light', 'clouds', 'rainbow', 'sun', 'water', 'ocean', 'river', 'lake',
  'waterfall', 'forest', 'tree', 'mountain', 'snow', 'rose', 'flowers', 'wind', 'waves', 'bird',
  'butterfly', 'owl', 'whale', 'dolphin', 'deer', 'fox', 'cat', 'turtle', 'elephant', 'horse',
  'unicorn', 'fish', 'key', 'door', 'mirror', 'book', 'letter', 'candle', 'clock', 'window', 'boat',
  'train', 'gift', 'bridge', 'stairs', 'garden', 'island', 'lighthouse', 'library', 'path', 'beach',
  'castle', 'house',
].filter((id) => getSymbolById(id) && getSymbolIllustration(id, 'poster'));

/** The same symbol all day long, another tomorrow; a prime stride visits every one before any returns. */
function getDailySymbolId(now: number): string | undefined {
  const date = new Date(now);
  const day = Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return DAILY_SYMBOLS[(day * 97) % DAILY_SYMBOLS.length];
}

type Tile = {
  key: string;
  art: ImageSource | number | undefined;
  /** Drawn in place of a painting. */
  scene?: React.ReactNode;
  eyebrow?: string;
  title: string;
  onPress: () => void;
  testID: string;
};

type Props = {
  now: number;
  selectedRitualId: RitualId;
  sleepSoundsAvailable: boolean;
};

/** Painted doors to the app's resources, led by a symbol of the day from the dictionary. */
export const HomeDiscoverTiles = memo(function HomeDiscoverTiles({ now, selectedRitualId, sleepSoundsAvailable }: Props) {
  const { mode } = useTheme();
  const { t, currentLang } = useTranslation();
  const language = currentLang ?? 'en';
  const artMode = mode === 'light' ? 'light' : 'dark';
  const symbolId = getDailySymbolId(now);
  const symbol = symbolId ? getSymbolById(symbolId) : undefined;
  const guideCopy = useMemo(() => getDreamGuideCopy(language as DreamGuideLanguage), [language]);
  const sleepCopy = useMemo(() => getSleepSoundCopy(language), [language]);
  const { formatNumber } = useLocaleFormatting();
  const badges = useBadgeSummary();

  const doors: Tile[] = [
    ...(symbolId && symbol ? [{
      key: 'symbol',
      art: getSymbolIllustration(symbolId, 'poster'),
      eyebrow: t('home.discover.symbol_of_day'),
      title: symbol[language]?.name ?? symbol.en.name,
      onPress: () => router.push({ pathname: '/symbol-detail/[id]', params: { id: symbolId } }),
      testID: TID.Button.HomeDailySymbol,
    }] : []),
    {
      key: 'ritual',
      art: DISCOVER_ARTWORK.ritual,
      title: t('inspiration.ritual.title'),
      onPress: () => router.push(`/ritual/${selectedRitualId}` as any),
      testID: TID.Button.HomeResourcesRitual,
    },
    ...(sleepSoundsAvailable ? [{
      key: 'sleep',
      art: DISCOVER_ARTWORK.sleep,
      title: sleepCopy.screenTitle,
      onPress: () => router.push('/sleep-sounds' as any),
      testID: TID.Button.HomeSleepSounds,
    }] : []),
    {
      key: 'guides',
      art: DISCOVER_ARTWORK.guides,
      title: guideCopy.screenTitle,
      onPress: () => router.push('/dream-guides' as any),
      testID: TID.Button.HomeResourcesGuides,
    },
    {
      key: 'symbols',
      art: getDreamerArtwork('symbols', artMode),
      title: t('symbols.home_card_title'),
      onPress: () => router.push('/symbol-dictionary' as any),
      testID: TID.Button.HomeResourcesSymbols,
    },
    {
      key: 'collection',
      art: undefined,
      scene: <View className="absolute inset-x-0 top-3 items-center"><CollectionFan width={112} /></View>,
      // A card waiting to be turned over is said first.
      eyebrow: badges.unrevealedCards > 0 ? badgeNewCardsText(t, badges.unrevealedCards, formatNumber) : undefined,
      title: t('badges.title'),
      onPress: () => router.push(COLLECTION_ROUTE),
      testID: 'btn.home.collection',
    },
  ];
  // A card waiting to be turned over moves the collection beside the symbol of the day.
  const collectionDoor = doors[doors.length - 1];
  const tiles = badges.unrevealedCards > 0
    ? [...doors.slice(0, 1), collectionDoor, ...doors.slice(1, -1)]
    : doors;

  return (
    <View testID={TID.Component.HomeResources} accessibilityRole="summary"
      accessibilityLabel={t('home.today.resources')} className="gap-3">
      <View className="flex-row items-start gap-3">
        <View className="mt-[9px] h-px w-[22px] bg-champagne" />
        <Text className="min-w-0 shrink font-sans-medium text-caption leading-[18px] uppercase tracking-[1.6px] text-champagne-on">
          {t('home.today.resources')}
        </Text>
      </View>
      {/* The row runs to the screen's edges, so the next painting peeks out as a cue to scroll. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}>
        {tiles.map((tile) => (
          <PressableScale key={tile.key} onPress={tile.onPress} accessibilityRole="button"
            accessibilityLabel={tile.eyebrow ? `${tile.eyebrow}, ${tile.title}` : tile.title}
            testID={tile.testID} style={TILE}
            className="overflow-hidden rounded-[20px] border border-line">
            {tile.art ? <Image source={tile.art} contentFit="cover" cachePolicy="memory-disk" style={IMAGE_FILL} /> : tile.scene ?? null}
            {/* Dense from mid-height: three-line titles start there, even on the light paintings. */}
            <LinearGradient colors={VEIL} locations={[0.2, 0.45, 0.65, 1]} style={IMAGE_FILL} />
            <View className="flex-1 justify-end p-3.5">
              {/* Tighter than the overline's tracking: « Symbol des Tages » holds one line in a tile. */}
              {tile.eyebrow ? <Text maxFontSizeMultiplier={1.3} style={{ color: NIGHT.accent.text }}
                className="font-sans-medium text-overline uppercase tracking-[0.8px]">
                {tile.eyebrow}
              </Text> : null}
              <Text numberOfLines={3} maxFontSizeMultiplier={1.3} style={{ color: NIGHT.text.primary }}
                className="mt-0.5 font-display-semibold text-h3 leading-[21px]">
                {tile.title}
              </Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
});
