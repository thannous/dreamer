import { EASE } from '@/components/motion/motion';
import { LivingPainting } from '@/components/symbols/LivingPainting';
import { SymbolArtwork } from '@/components/symbols/SymbolArtwork';
import {
  SymbolInterpretation,
  SymbolInterpretationUnavailable,
  SymbolQuestions,
  SymbolSection,
  SymbolVariations,
} from '@/components/symbols/SymbolReading';
import { readScenes, SymbolScenes } from '@/components/symbols/SymbolScenes';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DarkTheme, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { DREAMER_ARTWORK } from '@/constants/dreamerArtwork';
import { Fonts } from '@/constants/theme';
import { useContentWindow } from '@/context/ContentWindowContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useExtendedSymbolContent } from '@/hooks/useExtendedSymbolContent';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useSymbolContent } from '@/hooks/useSymbolContent';
import { useSymbolAtlasEntry } from '@/hooks/useSymbolAtlas';
import { useTranslation } from '@/hooks/useTranslation';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import { atlasPictureSources } from '@/lib/symbolAtlas';
import { useBadgeReading } from '@/hooks/useBadgeReading';
import { TID } from '@/lib/testIDs';
import { recordBadgeEvent } from '@/services/badgeLedgerStore';
import type { DreamSymbol, SymbolLanguage } from '@/lib/symbolTypes';
import {
  getCategoryName,
  getRelatedSymbols,
  getSymbolById,
} from '@/services/symbolDictionaryService';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { usePaintingArrival } from '@/components/ui/headerStretch';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TypeScale } from '@/constants/typeScale';

type Tokens = ReturnType<typeof getNoctaliaDesignTokens>;

// The hero always sits on painted night artwork, whatever the app theme, like the
// site's symbol pages. The reading column below follows the user's theme.
const HERO_TOKENS = getNoctaliaDesignTokens(DarkTheme, 'dark');
const SKY_FALLBACK = DREAMER_ARTWORK.symbols;
const TOP_BAR_HEIGHT = 52;
// How much of the painting, from its foot, the title and description may cover before the
// painting grows to hold them.
const HERO_COPY_SHARE = 0.55;
// The painting's veil is dark enough to read on over about its lower 40 %: copy that climbs
// higher brings a veil of its own.
const VEIL_DARK_SHARE = 0.4;
// How far above the title the copy's own veil starts to darken.
const COPY_VEIL_LEAD = 48;
const BODY_GUTTER = 24;
const BODY_MAX_WIDTH = 680;
// The painted scenes keep a reading size on a wide window.
const SCENES_MAX_WIDTH = 640;

// Over a living painting the name rises just after the sheet opens, so the painting is
// seen first. One object, so a render never starts it again.
const COPY_RISE = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: 14 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: 700,
  animationDelay: 320,
  animationTimingFunction: EASE.out,
  animationFillMode: 'both',
} as const;

/** The same colour at zero alpha, so a fade never darkens a light page. */
const transparentOf = (color: string) =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'transparent';

export default function SymbolDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { state: onboardingState } = useOnboarding();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  // Direct assignment on purpose: it is a compile error if AppLanguage ever
  // gains a language the bundled dictionary has no content for.
  const lang: SymbolLanguage = currentLang;
  const scrollPerf = useScrollIdle();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useContentWindow();
  // Measured, since a wide web window may give the screen less than the window.
  const [heroWidth, setHeroWidth] = useState(windowWidth);
  const [heroCopyHeight, setHeroCopyHeight] = useState(0);
  const [bodyWidth, setBodyWidth] = useState(windowWidth);
  const reducedMotion = useReducedMotion();
  const trackedSymbolRef = useRef<string | null>(null);
  const scrollY = useSharedValue(0);

  const symbol = useMemo(() => getSymbolById(id!), [id]);
  const { content: extended, status: extendedStatus } = useExtendedSymbolContent(id, lang);
  // Bundled, read once per language: only the very first symbol opened waits a moment.
  const reading = useSymbolContent(lang)?.[id!];
  const relatedSymbols = useMemo(() => (symbol ? getRelatedSymbols(symbol) : []), [symbol]);
  // The symbols the site paints alive open on that painting, held upright for a phone.
  // The sheet keeps the look it opened with: an atlas that arrives while it is open (a
  // first launch) shows from the next visit instead of reshaping the page under the reader.
  const latestLiving = useSymbolAtlasEntry(symbol?.id);
  const [openedWith] = useState(() => ({ id: symbol?.id, living: latestLiving }));
  const living = openedWith.id === symbol?.id ? openedWith.living : latestLiving;
  const variations = extended?.variations;
  const sceneReadings = useMemo(
    () => (living && variations ? readScenes(living.entry.scenes, variations, lang) : []),
    [lang, living, variations],
  );

  useEffect(() => {
    if (!symbol || trackedSymbolRef.current === symbol.id) return;
    trackedSymbolRef.current = symbol.id;

    const analyticsSource =
      source === 'onboarding' ||
      source === 'dictionary' ||
      source === 'search' ||
      source === 'guide'
        ? source
        : 'unknown';
    void trackProductEvent('symbol_detail_viewed', { source: analyticsSource });

    if (source === 'onboarding' && onboardingState.completionReason === 'dictionary') {
      void trackProductEvent(
        'first_value_viewed',
        buildFirstValueProperties(onboardingState, 'symbol_detail')
      );
    }
  }, [onboardingState, source, symbol]);
  // For the collection: an entry read to its end, whichever way it was opened. The end of
  // the text is compared on the UI thread; React hears of it once, when it comes into view.
  const symbolId = symbol?.id ?? null;
  // Only a loaded entry has an end: while its interpretation loads, or offline, the short body
  // a tall window shows whole is not the entry read.
  const textLoaded = extendedStatus === 'ready';
  const hasFullText = Boolean(extended?.fullInterpretation);
  const textEndY = useSharedValue(Number.POSITIVE_INFINITY);
  const bodyEnd = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    // Without a full interpretation the body keeps the layout it had while loading.
    if (textLoaded && !hasFullText) textEndY.set(bodyEnd.current);
  }, [hasFullText, textEndY, textLoaded]);
  const viewportHeight = useSharedValue(0);
  const [readToEndOf, setReadToEndOf] = useState<string | null>(null);
  useBadgeReading(symbolId !== null && readToEndOf === symbolId ? symbolId : null, () => {
    if (symbolId) recordBadgeEvent({ type: 'symbol_read', symbolId });
  });

  // On the paper theme the night scene needs room to dawn into the page below its copy.
  const heroDusk = mode === 'light' ? 72 : 0;
  // A living painting takes most of the screen: the page opens inside it.
  const paintingHeight = living
    ? Math.max(460, windowHeight * 0.75)
    : Math.min(560, Math.max(380, windowHeight * 0.58));
  // The copy rests on the painting's darkened lower part. A short, narrow window (the folded
  // iPhone Duo) wraps the description into more lines than that part holds, so the painting
  // grows instead of laying the copy over its bright middle.
  const copyFitHeight = Math.min(windowHeight * 0.9, Math.max(0, heroCopyHeight - heroDusk) / HERO_COPY_SHARE);
  const heroHeight = Math.round(Math.max(paintingHeight, copyFitHeight)) + heroDusk;
  // Even grown (up to 90 % of the window), the painting can leave a long description's title
  // and first lines on its lighter middle: the copy then brings a veil of its own, deeper the
  // higher it climbs. Measured against the whole hero, as the painting's own veil is.
  const copyShare = heroHeight > 0 ? heroCopyHeight / heroHeight : 0;
  const copyVeil = Math.min(1, Math.max(0, (copyShare - VEIL_DARK_SHARE) / 0.15)) * 0.5;
  const heroFrame = useMemo(() => ({ width: heroWidth, height: heroHeight }), [heroHeight, heroWidth]);
  const backdropSource = useMemo(
    // The smallest width is plenty under a 40 point blur.
    () => (living && symbol ? atlasPictureSources(living.atlas, symbol.id, living.entry.portrait)[0] : undefined),
    [living, symbol],
  );
  const collapseAt = heroHeight - insets.top - TOP_BAR_HEIGHT;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  useAnimatedReaction(() => scrollY.get() + viewportHeight.get() >= textEndY.get(), (reached, previous) => {
    if (reached && !previous && symbolId) scheduleOnRN(setReadToEndOf, symbolId);
  }, [symbolId]);

  // Scroll-derived, so it runs on the UI thread. The artwork drifts at a third of
  // the scroll speed and the page reads as a window onto the sky; reduce motion
  // keeps it pinned to the content.
  // Like every painting, the hero settles as the sheet opens.
  const heroArrival = usePaintingArrival();
  const heroArtStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    const y = scrollY.get();
    return {
      transform: [
        { translateY: y > 0 ? y * 0.35 : y },
        { scale: y < 0 ? 1 + -y / heroHeight : 1 },
      ],
    };
  });

  // State indication: once the hero has scrolled away, a solid bar with the
  // symbol's name takes over so the content never runs under the status bar.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [collapseAt - 48, collapseAt], [0, 1], Extrapolation.CLAMP),
  }));

  if (!symbol) {
    return (
      <View style={[styles.emptyState, { backgroundColor: noctalia.screen.background }]}>
        <DreamerArtworkWindow scene="symbols" />
        <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
          {t('symbols.not_found')}
        </Text>
      </View>
    );
  }

  const name = symbol.names[lang] ?? symbol.names.en;
  const categoryName = getCategoryName(symbol.category, lang);
  const illustration = getSymbolIllustration(symbol.id, 'hero');
  const background = noctalia.screen.background;

  return (
    <ScrollPerfProvider activity={scrollPerf.activity}>
      <View style={[styles.screen, { backgroundColor: background }]} testID={TID.Screen.SymbolDetail}>
        {mode === 'dark' ? (
          // The reading column keeps the symbol's night around it instead of
          // falling onto flat black once the hero has scrolled away.
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
            <Image
              source={backdropSource ?? illustration ?? SKY_FALLBACK}
              contentFit="cover"
              blurRadius={40}
              style={[StyleSheet.absoluteFill, styles.backdropArt]}
            />
            <LinearGradient
              colors={['rgba(3,4,13,0.42)', 'rgba(3,4,13,0.72)', 'rgba(3,4,13,0.9)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 56 }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onLayout={(event: LayoutChangeEvent) => viewportHeight.set(event.nativeEvent.layout.height)}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View style={[styles.hero, { height: heroHeight }]} onLayout={(event: LayoutChangeEvent) => setHeroWidth(event.nativeEvent.layout.width)}>
            {/* Opened from a thumbnail on iOS 18 and later, the sheet grows out of it into
                this painting, and shrinks back into it on the way back. */}
            <Link.AppleZoomTarget>
              <Animated.View
                style={[StyleSheet.absoluteFill, heroArtStyle]}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <Animated.View style={[StyleSheet.absoluteFill, heroArrival]}>
                  {living ? (
                    <LivingPainting
                      atlas={living.atlas}
                      symbolId={symbol.id}
                      picture={living.entry.portrait}
                      position={living.entry.portrait.position}
                      layers={living.entry.layers}
                      frame={heroFrame}
                      arrive
                      placeholder={SKY_FALLBACK}
                      transition={200}
                    />
                  ) : (
                    <Image
                      source={illustration ?? SKY_FALLBACK}
                      // Offline before the first visit, the sheet keeps its night sky.
                      placeholder={illustration ? SKY_FALLBACK : undefined}
                      placeholderContentFit="cover"
                      contentFit="cover"
                      contentPosition={illustration ? 'center' : 'top'}
                      transition={illustration ? 200 : 0}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                </Animated.View>
              </Animated.View>
            </Link.AppleZoomTarget>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(8,3,15,0.55)', 'rgba(8,3,15,0.04)', 'rgba(8,3,15,0.45)', 'rgba(9,4,19,0.92)']}
              locations={[0, 0.3, 0.56, 0.9]}
              style={StyleSheet.absoluteFill}
            />
            {copyVeil > 0 ? (
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(9,4,19,0)', `rgba(9,4,19,${copyVeil.toFixed(2)})`]}
                locations={[0, COPY_VEIL_LEAD / (heroCopyHeight + COPY_VEIL_LEAD)]}
                style={[styles.copyVeil, { height: heroCopyHeight + COPY_VEIL_LEAD }]}
              />
            ) : null}
            <LinearGradient
              pointerEvents="none"
              colors={mode === 'dark'
                ? ['rgba(9,4,19,0)', 'rgba(3,4,13,0.42)']
                // Eased from night into paper below the copy, instead of a 36 point step.
                : ['rgba(9,4,19,0)', `${background}38`, `${background}99`, `${background}E0`, background]}
              locations={mode === 'dark' ? undefined : [0, 0.3, 0.58, 0.82, 1]}
              style={[styles.heroFade, heroDusk ? { height: heroDusk + 36 } : null]}
            />
            <Animated.View
              onLayout={(event: LayoutChangeEvent) => setHeroCopyHeight(Math.ceil(event.nativeEvent.layout.height))}
              style={[styles.heroCopy, heroDusk ? { paddingBottom: 30 + heroDusk } : null, living && !reducedMotion ? COPY_RISE : null]}>
              <View style={[styles.chip, { borderColor: 'rgba(234,212,180,0.45)' }]}>
                <Text style={[styles.chipText, { color: HERO_TOKENS.accent.text }]}>{categoryName}</Text>
              </View>
              <Text
                selectable
                accessibilityRole="header"
                style={[styles.title, { color: HERO_TOKENS.text.primary }]}
              >
                {name}
              </Text>
              <MarkdownText
                selectable
                style={[styles.lede, { color: HERO_TOKENS.text.secondary }]}
              >
                {reading?.shortDescription ?? ''}
              </MarkdownText>
            </Animated.View>
          </View>

          <View style={styles.body} onLayout={(event: LayoutChangeEvent) => {
            const { y, width, height } = event.nativeEvent.layout;
            setBodyWidth(width);
            bodyEnd.current = y + height;
            if (textLoaded) textEndY.set(bodyEnd.current);
          }}>
            {/* The hero has given the symbol's sense. The interpretation follows, closed on
                its opening; then the reader finds their own dream (its scene, its
                situation, a few questions). */}
            {extended?.fullInterpretation ? (
              <SymbolInterpretation html={extended.fullInterpretation} ink={noctalia} />
            ) : extendedStatus === 'unavailable' ? (
              <SymbolInterpretationUnavailable />
            ) : null}

            {living && sceneReadings.length > 0 ? (
              <SymbolSection label={t('symbols.scenes')}>
                <SymbolScenes
                  atlas={living.atlas}
                  symbolId={symbol.id}
                  readings={sceneReadings}
                  width={Math.min(SCENES_MAX_WIDTH, bodyWidth - BODY_GUTTER * 2)}
                  noctalia={noctalia}
                />
              </SymbolSection>
            ) : null}

            {extended?.variations && extended.variations.length > 0 ? (
              <SymbolVariations variations={extended.variations} ink={noctalia} />
            ) : null}

            {reading && reading.askYourself.length > 0 ? (
              <SymbolQuestions questions={reading.askYourself} ink={noctalia} />
            ) : null}

            {relatedSymbols.length > 0 ? (
              <SymbolSection label={t('symbols.related')}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.relatedScroller}
                  contentContainerStyle={styles.relatedPosters}
                >
                  {relatedSymbols.map((related) => (
                    <RelatedPoster key={related.id} symbol={related} lang={lang} noctalia={noctalia} />
                  ))}
                </ScrollView>
              </SymbolSection>
            ) : null}
            {/* The entry's last line: reaching it is reading the entry to its end. */}
            <View testID="symbol.detail.end" />
          </View>
        </Animated.ScrollView>

        <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, barStyle]}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]} />
            <LinearGradient
              colors={[background, transparentOf(background)]}
              style={styles.topBarEdge}
            />
          </Animated.View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('journal.back_button')}
            hitSlop={8}
          >
            <IconSymbol name="chevron.left" size={21} color={HERO_TOKENS.text.primary} />
          </Pressable>
          <Animated.Text
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
            style={[styles.barTitle, { color: noctalia.text.primary }, barStyle]}
          >
            {name}
          </Animated.Text>
        </View>
      </View>
    </ScrollPerfProvider>
  );
}

function RelatedPoster({ symbol, lang, noctalia }: { symbol: DreamSymbol; lang: SymbolLanguage; noctalia: Tokens }) {
  const name = symbol.names[lang] ?? symbol.names.en;
  // Large text widens the poster so a long single word never breaks mid-word.
  const { fontScale } = useWindowDimensions();
  const posterWidth = Math.round(140 * Math.min(Math.max(fontScale, 1), 1.5));
  return (
    <Pressable
      onPress={() => router.replace(`/symbol-detail/${symbol.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.poster,
        { width: posterWidth },
        { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
        pressed && styles.posterPressed,
      ]}
    >
      <SymbolArtwork symbolId={symbol.id} size="poster" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(9,4,19,0)', 'rgba(9,4,19,0.88)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.posterCategory, { color: HERO_TOKENS.accent.text }]} numberOfLines={1}>
        {getCategoryName(symbol.category, lang)}
      </Text>
      <Text
        style={[styles.posterName, { color: HERO_TOKENS.text.primary }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ThemeLayout.spacing.md,
    overflow: 'hidden',
  },
  emptyText: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.body.fontSize },
  hero: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#090413' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
  copyVeil: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroCopy: { paddingHorizontal: 24, paddingBottom: 30, gap: 14 },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(9,4,19,0.35)',
  },
  chipText: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.overline.fontSize,
    lineHeight: TypeScale.overline.lineHeight,
    letterSpacing: TypeScale.overline.letterSpacing,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(8,3,15,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  lede: { fontFamily: Fonts.fraunces.regular, fontSize: TypeScale.h3.fontSize, lineHeight: 27 },
  // A reading measure on a wide window: lines stay short enough to follow.
  body: { width: '100%', maxWidth: BODY_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: BODY_GUTTER, paddingTop: 8 },
  backdropArt: { opacity: 0.75, transform: [{ scale: 1.2 }] },
  relatedScroller: { marginHorizontal: -24 },
  relatedPosters: { gap: 12, paddingHorizontal: 24 },
  poster: { width: 140, height: 184, borderRadius: 16, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'flex-end', padding: 12, gap: 4 },
  posterPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  posterCategory: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.overline.fontSize, lineHeight: TypeScale.overline.lineHeight, letterSpacing: TypeScale.overline.letterSpacing, textTransform: 'uppercase' },
  posterName: { fontFamily: Fonts.fraunces.medium, fontSize: TypeScale.h3.fontSize, lineHeight: 22 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  topBarEdge: { position: 'absolute', left: 0, right: 0, bottom: -28, height: 28 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,4,19,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,247,237,0.28)',
  },
  barTitle: { flex: 1, fontFamily: Fonts.fraunces.semiBold, fontSize: TypeScale.h3.fontSize, lineHeight: TypeScale.h3.lineHeight, paddingRight: 12 },
  pressed: { opacity: 0.72 },
});
