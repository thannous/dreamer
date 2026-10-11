import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { NightSkyBand } from '@/components/ui/NightSkyBand';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import { getFormattingLocale } from '@/lib/locale';
import { TID } from '@/lib/testIDs';
import type { TodayState } from '@/lib/todayState';
import type { DreamAnalysis } from '@/lib/types';
import { useHeaderStretchStyle, usePaintingBreath, usePaintingDepthStyle } from '@/components/ui/headerStretch';
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
  const insets = useSafeAreaInsets();
  const media = useDreamMedia(dream);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = media.imageUrl
    ? withCacheBuster(media.imageUrl, getDreamImageVersion(dream ?? {}))
    : '';
  const source = useMemo(() => uri ? { uri, cacheKey: media.imageCacheKey } : undefined, [uri, media.imageCacheKey]);
  const hasArtwork = Boolean(source && uri !== failedUri);
  const immersiveArtwork = hasArtwork && fontScale < 1.5;
  const stageHeight = immersiveArtwork
    ? Math.min(560, Math.max(300, height * 0.58 - insets.top))
    : undefined;
  // Pulling the page down stretches the dream's image over the gap, like every header painting.
  const artworkStretch = useHeaderStretchStyle((stageHeight ?? 260) + 1);
  // Like the paintings: the dream's image breathes and lags behind the page as it scrolls.
  const artworkDepth = usePaintingDepthStyle(stageHeight ?? 260);
  const artworkBreath = usePaintingBreath();
  const locale = getFormattingLocale(currentLang ?? 'en');
  const formattedDate = new Date(now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = formattedDate.charAt(0).toLocaleUpperCase(locale) + formattedDate.slice(1);
  const ground = tokens.screen.background;
  const image = <Image testID="image.home.today" source={source} contentFit="cover" contentPosition="center"
    cachePolicy="memory-disk" recyclingKey={`${dream?.id}:${uri}`} transition={0}
    onError={() => setFailedUri(uri)} style={IMAGE_FILL} />;

  return (
    <View className="relative bg-ink">
      {/* No dream artwork yet: the night sky fills the opening from the top of the screen, like every tab header. */}
      {!hasArtwork ? <NightSkyBand height={insets.top + 340} background={ground} scene="reverie" /> : null}
      {immersiveArtwork ? <Animated.View className="absolute left-0 right-0 top-0 overflow-hidden"
        pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[{ height: (stageHeight ?? 260) + 1, transformOrigin: 'top center' }, artworkStretch]}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 80, bottom: -80 }, artworkDepth]}>
          <Animated.View style={[IMAGE_FILL, artworkBreath]}>{image}</Animated.View>
        </Animated.View>
        <LinearGradient colors={[ground, `${ground}F5`, `${ground}E6`, `${ground}00`]}
          locations={[0, 0.65, 0.84, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 190 }} />
        <LinearGradient colors={[`${ground}00`, `${ground}C0`, ground]} locations={[0, 0.65, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }} />
      </Animated.View> : null}
      <View className="justify-between" style={{ minHeight: stageHeight }}>
        <View className="pb-4">
          {/* The hero paints its own artwork or sky, so the shared header stays transparent. */}
          <NoctaliaScreenHeader
            titleKey="nav.home"
            variant="tab"
            subtitle={dateLabel}
            backdrop={false}
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
