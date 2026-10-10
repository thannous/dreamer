import { MarkdownText } from '@/components/ui/MarkdownText';
import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DarkTheme, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { DREAMER_ARTWORK } from '@/constants/dreamerArtwork';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useExtendedSymbolContent } from '@/hooks/useExtendedSymbolContent';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { DreamSymbol, SymbolLanguage, SymbolVariation } from '@/lib/symbolTypes';
import {
  getCategoryName,
  getRelatedSymbols,
  getSymbolById,
  parseHtmlParagraphs,
} from '@/services/symbolDictionaryService';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePaintingBreath } from '@/components/ui/headerStretch';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tokens = ReturnType<typeof getNoctaliaDesignTokens>;

// The hero always sits on painted night artwork, whatever the app theme, like the
// site's symbol pages. The reading column below follows the user's theme.
const HERO_TOKENS = getNoctaliaDesignTokens(DarkTheme, 'dark');
const SKY_FALLBACK = DREAMER_ARTWORK.symbols;
const TOP_BAR_HEIGHT = 52;

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
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const trackedSymbolRef = useRef<string | null>(null);
  const scrollY = useSharedValue(0);

  const symbol = useMemo(() => getSymbolById(id!), [id]);
  const { content: extended, status: extendedStatus } = useExtendedSymbolContent(id, lang);
  const relatedSymbols = useMemo(() => (symbol ? getRelatedSymbols(symbol) : []), [symbol]);

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

  // On the paper theme the night scene needs room to dawn into the page below its copy.
  const heroDusk = mode === 'light' ? 72 : 0;
  const heroHeight = Math.round(Math.min(560, Math.max(380, windowHeight * 0.58))) + heroDusk;
  const collapseAt = heroHeight - insets.top - TOP_BAR_HEIGHT;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Scroll-derived, so it runs on the UI thread. The artwork drifts at a third of
  // the scroll speed and the page reads as a window onto the sky; reduce motion
  // keeps it pinned to the content.
  // Like every painting, the hero breathes while the sheet is open.
  const heroBreath = usePaintingBreath();
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

  const content = symbol[lang] ?? symbol.en;
  const categoryName = getCategoryName(symbol.category, lang);
  const illustration = getSymbolIllustration(symbol.id, 'hero');
  const paragraphs = extended?.fullInterpretation
    ? parseHtmlParagraphs(extended.fullInterpretation)
    : [];
  const background = noctalia.screen.background;

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.screen, { backgroundColor: background }]} testID={TID.Screen.SymbolDetail}>
        {mode === 'dark' ? (
          // The reading column keeps the symbol's night around it instead of
          // falling onto flat black once the hero has scrolled away.
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
            <Image
              source={illustration ?? SKY_FALLBACK}
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
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View style={[styles.hero, { height: heroHeight }]}>
            <Animated.View
              style={[StyleSheet.absoluteFill, heroArtStyle]}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View style={[StyleSheet.absoluteFill, heroBreath]}>
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
              </Animated.View>
            </Animated.View>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(8,3,15,0.55)', 'rgba(8,3,15,0.04)', 'rgba(8,3,15,0.30)', 'rgba(9,4,19,0.92)']}
              locations={[0, 0.3, 0.56, 0.9]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={mode === 'dark'
                ? ['rgba(9,4,19,0)', 'rgba(3,4,13,0.42)']
                // Eased from night into paper below the copy, instead of a 36 point step.
                : ['rgba(9,4,19,0)', `${background}38`, `${background}99`, `${background}E0`, background]}
              locations={mode === 'dark' ? undefined : [0, 0.3, 0.58, 0.82, 1]}
              style={[styles.heroFade, heroDusk ? { height: heroDusk + 36 } : null]}
            />
            <View style={[styles.heroCopy, heroDusk ? { paddingBottom: 30 + heroDusk } : null]}>
              <View style={[styles.chip, { borderColor: 'rgba(234,212,180,0.45)' }]}>
                <Text style={[styles.chipText, { color: HERO_TOKENS.accent.text }]}>{categoryName}</Text>
              </View>
              <Text
                selectable
                accessibilityRole="header"
                style={[styles.title, { color: HERO_TOKENS.text.primary }]}
              >
                {content.name}
              </Text>
              <MarkdownText
                selectable
                style={[styles.lede, { color: HERO_TOKENS.text.secondary }]}
              >
                {content.shortDescription}
              </MarkdownText>
            </View>
          </View>

          <View style={styles.body}>
            {paragraphs.length > 0 ? (
              <Section label={t('symbols.interpretation')} noctalia={noctalia}>
                {/* The opening paragraph reads as a lead, like the site's summary;
                    the rest stays a quieter sans so the column has a rhythm. */}
                <MarkdownText style={[styles.proseLead, { color: noctalia.text.primary }]}>
                  {paragraphs[0]}
                </MarkdownText>
                {paragraphs.length > 1 ? (
                  <MarkdownText containerStyle={styles.proseRest} style={[styles.prose, { color: noctalia.text.secondary }]}>
                    {paragraphs.slice(1).join('\n\n')}
                  </MarkdownText>
                ) : null}
              </Section>
            ) : extendedStatus === 'unavailable' ? (
              <Section label={t('symbols.interpretation')} noctalia={noctalia}>
                <Text style={[styles.prose, { color: noctalia.text.secondary }]}>
                  {t('symbols.interpretation_offline')}
                </Text>
              </Section>
            ) : null}

            {extended?.variations && extended.variations.length > 0 ? (
              <Section label={t('symbols.variations')} noctalia={noctalia}>
                {extended.variations.map((variation, index) => (
                  <VariationRow
                    key={`${variation.context}-${variation.meaning}`}
                    variation={variation}
                    index={index}
                    noctalia={noctalia}
                  />
                ))}
              </Section>
            ) : null}

            {content.askYourself.length > 0 ? (
              <Section label={t('symbols.ask_yourself')} noctalia={noctalia}>
                {content.askYourself.map((question, index) => (
                  <View
                    key={`${question}-${index}`}
                    style={[
                      styles.askRow,
                      { borderTopColor: noctalia.surface.border },
                    ]}
                  >
                    <MarkdownText
                      selectable
                      containerStyle={{ flex: 1 }}
                      style={[styles.askText, { color: noctalia.text.primary }]}
                    >
                      {question}
                    </MarkdownText>
                  </View>
                ))}
              </Section>
            ) : null}

            {relatedSymbols.length > 0 ? (
              <Section label={t('symbols.related')} noctalia={noctalia}>
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
              </Section>
            ) : null}
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
            {content.name}
          </Animated.Text>
        </View>
      </View>
    </ScrollPerfProvider>
  );
}

function Section({ label, noctalia, children }: { label: string; noctalia: Tokens; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { borderTopColor: noctalia.surface.border }]}>
      <View style={[styles.sectionMark, { backgroundColor: noctalia.accent.text }]} />
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function VariationRow({ variation, index, noctalia }: {
  variation: SymbolVariation; index: number; noctalia: Tokens;
}) {
  return (
    <View
      style={[
        styles.variationRow,
        { borderTopColor: noctalia.surface.border },
      ]}
    >
      <Text style={[styles.variationNumber, { color: noctalia.accent.text }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <View style={styles.variationCopy}>
        <Text selectable style={[styles.variationContext, { color: noctalia.text.primary }]}>
          {variation.context}
        </Text>
        <MarkdownText selectable style={[styles.variationMeaning, { color: noctalia.text.secondary }]}>
          {variation.meaning}
        </MarkdownText>
      </View>
    </View>
  );
}

function RelatedPoster({ symbol, lang, noctalia }: { symbol: DreamSymbol; lang: SymbolLanguage; noctalia: Tokens }) {
  const content = symbol[lang] ?? symbol.en;
  const illustration = getSymbolIllustration(symbol.id, 'poster');
  // Large text widens the poster so a long single word never breaks mid-word.
  const { fontScale } = useWindowDimensions();
  const posterWidth = Math.round(140 * Math.min(Math.max(fontScale, 1), 1.5));
  return (
    <Pressable
      onPress={() => router.replace(`/symbol-detail/${symbol.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={content.name}
      style={({ pressed }) => [
        styles.poster,
        { width: posterWidth },
        { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
        pressed && styles.posterPressed,
      ]}
    >
      {illustration ? <Image source={illustration} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
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
        {content.name}
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
  emptyText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 16 },
  hero: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#090413' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
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
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
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
  lede: { fontFamily: Fonts.fraunces.regular, fontSize: 18, lineHeight: 27 },
  body: { paddingHorizontal: 24, paddingTop: 8 },
  backdropArt: { opacity: 0.75, transform: [{ scale: 1.2 }] },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 30, marginTop: 34 },
  sectionMark: { width: 28, height: 2, borderRadius: 1, marginBottom: 14 },
  sectionTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 25, lineHeight: 30, letterSpacing: -0.2, marginBottom: 18 },
  proseLead: { fontFamily: Fonts.fraunces.regular, fontSize: 19, lineHeight: 30 },
  proseRest: { marginTop: 18 },
  prose: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 28 },
  variationRow: { flexDirection: 'row', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 18 },
  variationNumber: { width: 26, paddingTop: 4, fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, opacity: 0.8 },
  variationCopy: { flex: 1, gap: 6 },
  variationContext: { fontFamily: Fonts.fraunces.semiBold, fontSize: 18, lineHeight: 24 },
  variationMeaning: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 25 },
  askRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16 },
  askText: { fontFamily: Fonts.fraunces.regular, fontSize: 18, lineHeight: 27 },
  relatedScroller: { marginHorizontal: -24 },
  relatedPosters: { gap: 12, paddingHorizontal: 24 },
  poster: { width: 140, height: 184, borderRadius: 16, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'flex-end', padding: 12, gap: 4 },
  posterPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  posterCategory: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 10, lineHeight: 13, letterSpacing: 1.6, textTransform: 'uppercase' },
  posterName: { fontFamily: Fonts.fraunces.medium, fontSize: 18, lineHeight: 22 },
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
  barTitle: { flex: 1, fontFamily: Fonts.fraunces.semiBold, fontSize: 19, lineHeight: 24, paddingRight: 12 },
  pressed: { opacity: 0.72 },
});
