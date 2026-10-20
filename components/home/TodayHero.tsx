import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { getDreamerArtwork } from '@/constants/dreamerArtwork';
import { ThemeLayout } from '@/constants/journalTheme';
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
import { PaintingTilt } from '@/components/ui/PaintingTilt';
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
// Below the headline: the tab header's bottom padding, then the wrapper's pb-4.
const HEADLINE_FOOT = ThemeLayout.spacing.md + 16;
// The reading veil gathers over this height before the headline's first line.
const VEIL_LEAD = 64;

const collapse = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * The dream's opening sentence, cut on a word when it runs long. None when the title already
 * is that opening, as for a dream not yet read: its title is its first line.
 */
function dreamExcerpt(text: string | undefined, title: string, max = 140): string {
  const clean = collapse(text);
  const opening = collapse(title).replace(/…$/, '');
  if (opening && clean.startsWith(opening)) return '';
  const end = clean.search(/[.!?…](\s|$)/);
  const sentence = end > 20 ? clean.slice(0, end + 1) : clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : sentence;
}

/**
 * The day's dream is the page's title: its name and first sentence rest at the foot of its
 * image. Without a dream, the headline asks for it. The user's theme changes the chrome and
 * reading veils, never the dream artwork.
 */
export function TodayHero({ state, dream, now, onPressCta, onOpenSettings }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t, currentLang } = useTranslation();
  const { height, fontScale } = useWindowDimensions();
  const media = useDreamMedia(dream);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headlineHeight, setHeadlineHeight] = useState(0);
  const uri = media.imageUrl
    ? withCacheBuster(media.imageUrl, getDreamImageVersion(dream ?? {}))
    : '';
  const source = useMemo(() => uri ? { uri, cacheKey: media.imageCacheKey } : undefined, [uri, media.imageCacheKey]);
  const hasArtwork = Boolean(source && uri !== failedUri);
  // Very large text keeps the whole width for the words: no stage, the image becomes a card.
  const immersive = fontScale < 1.5;
  const immersiveArtwork = hasArtwork && immersive;
  // The dream's image opens over a little more than half the screen, the day's painting over a
  // little less, and the headline rests at its foot, just above the action.
  const stageHeight = immersive
    ? Math.round(hasArtwork ? Math.min(600, Math.max(360, height * 0.55)) : Math.min(520, Math.max(320, height * 0.44)))
    : undefined;
  const sceneMode = mode === 'light' ? 'light' : 'dark';
  // Pulling the page down stretches the dream's image over the gap, like every header painting.
  const artworkStretch = useHeaderStretchStyle((stageHeight ?? 260) + 1);
  // Like the paintings: the dream's image settles as Today opens and lags behind the page as it scrolls.
  const artworkDepth = usePaintingDepthStyle(stageHeight ?? 260);
  const artworkArrival = usePaintingArrival();
  const locale = getFormattingLocale(currentLang ?? 'en');
  const formattedDate = new Date(now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = formattedDate.charAt(0).toLocaleUpperCase(locale) + formattedDate.slice(1);
  const ground = tokens.screen.background;
  const copyKey = state?.id ?? 'loading';
  const headline = dream?.title?.trim() || t(`home.today.${copyKey}.title`);
  const excerpt = dream ? dreamExcerpt(dream.transcript, dream.title ?? '') : '';
  // The veil starts just above the headline: the dream stays whole above it, and the headline
  // reads on the page's own ground, dark ink in the light theme and light ink in the dark one.
  const stage = (stageHeight ?? 260) + 1;
  const headlineTop = headerHeight && headlineHeight
    ? headerHeight - HEADLINE_FOOT - headlineHeight
    : stage / 2;
  const veilHeight = Math.min(stage, Math.max(110, stage - headlineTop + VEIL_LEAD));
  const veilLead = Math.min(0.6, VEIL_LEAD / veilHeight);
  const veilColors = mode === 'light'
    ? [`${ground}00`, `${ground}E0`, `${ground}F2`, ground] as const
    : [`${ground}00`, `${ground}8C`, `${ground}CC`, ground] as const;
  const halo = {
    textShadowColor: `${ground}D9`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  } as const;
  const image = <Image testID="image.home.today" source={source} contentFit="cover" contentPosition="center"
    cachePolicy="memory-disk" recyclingKey={`${dream?.id}:${uri}`} transition={0}
    onError={() => setFailedUri(uri)} style={IMAGE_FILL} />;

  return (
    <View className="relative bg-ink">
      {stageHeight ? <Animated.View className="absolute left-0 right-0 top-0 overflow-hidden"
        pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[{ height: stage, transformOrigin: 'top center' }, artworkStretch]}>
        {/* From the top edge, behind the header, like the paintings of the other tabs. */}
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, artworkDepth]}>
          <Animated.View style={[IMAGE_FILL, artworkArrival]}>
            {/* While it fills the top of the screen, the painting follows the phone's tilt. */}
            <PaintingTilt active dominantUntil={stage * 0.35}>
              {immersiveArtwork ? image : <Image testID="image.background.reverie" source={getDreamerArtwork('reverie', sceneMode)}
                contentFit="cover" contentPosition="top" cachePolicy="memory" recyclingKey={`reverie:${sceneMode}`}
                style={IMAGE_FILL} />}
            </PaintingTilt>
          </Animated.View>
        </Animated.View>
        <LinearGradient colors={veilColors} locations={[0, veilLead, (veilLead + 1) / 2, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: veilHeight }} />
      </Animated.View> : null}
      <View className="pb-4" onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        {/* The hero paints the dream, or the day's painting without one, and the header rests on
            it; only very large text leaves the night sky to the header. On the dream, which no
            theme changes, the wordmark and gear keep their night ink. */}
        <NoctaliaScreenHeader
          scene="reverie"
          titleKey="nav.home"
          variant="tab"
          immersive
          backdrop={!stageHeight && !hasArtwork}
          overArtwork={immersiveArtwork}
          immersiveHeight={stageHeight ? stageHeight - 56 : undefined}
          actions={[{
            icon: 'gear',
            onPress: onOpenSettings,
            accessibilityLabel: t('nav.settings'),
            testID: TID.Button.HeaderHomeSettings,
          }]}
          titleSlot={<View onLayout={(event) => setHeadlineHeight(event.nativeEvent.layout.height)}>
            {/* The tab bar already says Today: the date and the night frame the headline. */}
            <Text style={halo} maxFontSizeMultiplier={1.4}
              className="font-sans-medium text-[12px] uppercase tracking-[1.8px] text-champagne-on">
              {dream ? `${dateLabel} · ${t('home.today.dream_eyebrow')}` : dateLabel}
            </Text>
            <Text testID={TID.Text.HomeTodayTitle} accessibilityRole="header" style={halo}
              numberOfLines={3} maxFontSizeMultiplier={1.3}
              className="mt-1.5 font-display-semibold text-[30px] leading-[36px] text-ivory">
              {headline}
            </Text>
            {excerpt ? <Text style={halo} numberOfLines={2} maxFontSizeMultiplier={1.4}
              className="mt-2 font-serif-italic text-[16px] leading-6 text-ivory-muted">
              {t('home.today.dream_excerpt', { text: excerpt })}
            </Text> : !dream ? <Text testID={TID.Text.HomeTodayBody} style={halo} maxFontSizeMultiplier={1.4}
              className="mt-2 font-sans text-[15px] leading-[22px] text-ivory-muted">
              {t(`home.today.${copyKey}.body`)}
            </Text> : null}
          </View>}
        />
      </View>
      {hasArtwork && !immersiveArtwork ? <View className="mx-6 mb-6 h-[200px] overflow-hidden rounded-xl"
        accessible={false} importantForAccessibility="no-hide-descendants">{image}</View> : null}
      <TodayCard state={state} onPressCta={onPressCta} />
    </View>
  );
}
