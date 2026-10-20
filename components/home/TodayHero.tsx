import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import { getFormattingLocale } from '@/lib/locale';
import { TID } from '@/lib/testIDs';
import type { TodayState } from '@/lib/todayState';
import type { DreamAnalysis } from '@/lib/types';
import { useHeaderStretchStyle, usePaintingArrival, usePaintingDepthStyle } from '@/components/ui/headerStretch';
import Animated from 'react-native-reanimated';

type Props = {
  state: TodayState | null;
  dream: DreamAnalysis | null;
  now: number;
  onPressCta: () => void;
  onOpenSettings: () => void;
};

// expo-image and LinearGradient consume native props rather than Uniwind classes.
const IMAGE_FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const;

/** The user's theme changes the chrome and reading veils, never the dream artwork. */
export function TodayHero({ state, dream, now, onPressCta, onOpenSettings }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t, currentLang } = useTranslation();
  const { height, fontScale } = useWindowDimensions();
  const media = useDreamMedia(dream);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const uri = media.imageUrl
    ? withCacheBuster(media.imageUrl, getDreamImageVersion(dream ?? {}))
    : '';
  const source = useMemo(() => uri ? { uri, cacheKey: media.imageCacheKey } : undefined, [uri, media.imageCacheKey]);
  const hasArtwork = Boolean(source && uri !== failedUri);
  const immersiveArtwork = hasArtwork && fontScale < 1.5;
  // The dream's image opens over a little more than half the screen, and the title and the
  // date rest at its foot, just above the card.
  const stageHeight = immersiveArtwork
    ? Math.round(Math.min(600, Math.max(360, height * 0.55)))
    : undefined;
  // Pulling the page down stretches the dream's image over the gap, like every header painting.
  const artworkStretch = useHeaderStretchStyle((stageHeight ?? 260) + 1);
  // Like the paintings: the dream's image settles as Today opens and lags behind the page as it scrolls.
  const artworkDepth = usePaintingDepthStyle(stageHeight ?? 260);
  const artworkArrival = usePaintingArrival();
  const locale = getFormattingLocale(currentLang ?? 'en');
  const formattedDate = new Date(now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = formattedDate.charAt(0).toLocaleUpperCase(locale) + formattedDate.slice(1);
  const ground = tokens.screen.background;
  const image = <Image testID="image.home.today" source={source} contentFit="cover" contentPosition="center"
    cachePolicy="memory-disk" recyclingKey={`${dream?.id}:${uri}`} transition={0}
    onError={() => setFailedUri(uri)} style={IMAGE_FILL} />;

  return (
    <View className="relative bg-ink">
      {immersiveArtwork ? <Animated.View className="absolute left-0 right-0 top-0 overflow-hidden"
        pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[{ height: (stageHeight ?? 260) + 1, transformOrigin: 'top center' }, artworkStretch]}>
        {/* From the top edge, behind the header, like the paintings of the other tabs. */}
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, artworkDepth]}>
          <Animated.View style={[IMAGE_FILL, artworkArrival]}>{image}</Animated.View>
        </Animated.View>
        {/* A light reading veil rises from just above the title: the dream stays visible and the date reads. */}
        <LinearGradient colors={[`${ground}00`, `${ground}8C`, `${ground}CC`, ground]} locations={[0, 0.4, 0.7, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
            height: Math.max(110, (stageHeight ?? 260) + 1 - Math.max(0, headerHeight - 150)) }} />
      </Animated.View> : null}
      <View>
        <View className="pb-4" onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
          {/* Immersive like Explorer. Without dream artwork the header paints the night sky and the
              title rests at the same height as on the other tabs; with artwork the hero paints the
              dream, the header stays transparent and its title rests at the image's foot. */}
          <NoctaliaScreenHeader
            scene="reverie"
            titleKey="nav.home"
            variant="tab"
            immersive
            subtitle={dateLabel}
            backdrop={!hasArtwork}
            immersiveHeight={stageHeight ? stageHeight - 56 : undefined}
            actions={[{
              icon: 'gear',
              onPress: onOpenSettings,
              accessibilityLabel: t('nav.settings'),
              testID: TID.Button.HeaderHomeSettings,
            }]}
          />
        </View>
      </View>
      {hasArtwork && !immersiveArtwork ? <View className="mx-6 mb-6 h-[200px] overflow-hidden rounded-xl"
        accessible={false} importantForAccessibility="no-hide-descendants">{image}</View> : null}
      <TodayCard state={state} dreamTitle={dream?.title} onPressCta={onPressCta} />
    </View>
  );
}
