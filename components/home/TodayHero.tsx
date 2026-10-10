import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodayCard } from '@/components/home/TodayCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const locale = getFormattingLocale(currentLang ?? 'en');
  const formattedDate = new Date(now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = formattedDate.charAt(0).toLocaleUpperCase(locale) + formattedDate.slice(1);
  const ground = tokens.screen.background;
  const image = <Image testID="image.home.today" source={source} contentFit="cover" contentPosition="center"
    cachePolicy="memory-disk" recyclingKey={`${dream?.id}:${uri}`} transition={0}
    onError={() => setFailedUri(uri)} style={IMAGE_FILL} />;

  return (
    <View className="relative bg-ink">
      {/* No dream artwork yet: the night sky keeps the opening immersive instead of flat ink. */}
      {!hasArtwork ? <NightSkyBand height={insets.top + 340} background={ground} /> : null}
      {immersiveArtwork ? <View className="absolute left-0 right-0 top-0 overflow-hidden"
        pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ height: (stageHeight ?? 260) + 1 }}>
        <View className="absolute left-0 right-0" style={{ top: 80, bottom: -80 }}>{image}</View>
        <LinearGradient colors={[ground, `${ground}F5`, `${ground}E6`, `${ground}00`]}
          locations={[0, 0.65, 0.84, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 190 }} />
        <LinearGradient colors={[`${ground}00`, `${ground}C0`, ground]} locations={[0, 0.65, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }} />
      </View> : null}
      <View className="justify-between" style={{ minHeight: stageHeight }}>
        <View className="px-6 pb-8" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-2" accessible accessibilityLabel="Noctalia">
              <IconSymbol name="moon.stars.fill" size={22} color={tokens.accent.text} />
              <Text className="min-w-0 shrink font-display-medium text-[18px] leading-6 text-ivory">Noctalia</Text>
            </View>
            <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel={t('nav.settings')}
              testID={TID.Button.HeaderHomeSettings}
              className="h-11 w-11 items-center justify-center rounded-full bg-ink-soft active:opacity-70">
              <IconSymbol name="gear" size={24} color={tokens.text.primary} />
            </Pressable>
          </View>
          <Text accessibilityRole="header" className="font-display-semibold text-[38px] leading-[46px] text-ivory">{t('nav.home')}</Text>
          <Text className="mt-1 font-sans text-[15px] leading-[22px] text-ivory-muted">{dateLabel}</Text>
        </View>
      </View>
      {hasArtwork && !immersiveArtwork ? <View className="mx-6 mb-6 h-[200px] overflow-hidden rounded-xl"
        accessible={false} importantForAccessibility="no-hide-descendants">{image}</View> : null}
      <TodayCard state={state} dreamTitle={dream?.title} onPressCta={onPressCta} />
    </View>
  );
}
