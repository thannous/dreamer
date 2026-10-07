import { MarkdownText } from '@/components/ui/MarkdownText';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DarkTheme, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { DreamSymbol, SymbolLanguage, SymbolVariation } from '@/lib/symbolTypes';
import {
  getCategoryName,
  getExtendedContent,
  getRelatedSymbols,
  getSymbolById,
  parseHtmlParagraphs,
} from '@/services/symbolDictionaryService';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
const SKY_FALLBACK = require('@/assets/images/onboarding-reverie-background.webp');
const TOP_BAR_HEIGHT = 52;

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
  const extended = useMemo(() => (id ? getExtendedContent(id, lang) : undefined), [id, lang]);
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

  const heroHeight = Math.round(Math.min(560, Math.max(380, windowHeight * 0.58)));
  const collapseAt = heroHeight - insets.top - TOP_BAR_HEIGHT;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Scroll-derived, so it runs on the UI thread. The artwork drifts at a third of
  // the scroll speed and the page reads as a window onto the sky; reduce motion
  // keeps it pinned to the content.
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
        <AtmosphericBackground />
        <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
          {t('symbols.not_found')}
        </Text>
      </View>
    );
  }

  const content = symbol[lang] ?? symbol.en;
  const categoryName = getCategoryName(symbol.category, lang);
  const illustration = getSymbolIllustration(symbol.id);
  const paragraphs = extended?.fullInterpretation
    ? parseHtmlParagraphs(extended.fullInterpretation)
    : [];
  const background = noctalia.screen.background;

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.screen, { backgroundColor: background }]} testID={TID.Screen.SymbolDetail}>
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
              <Image
                source={illustration ?? SKY_FALLBACK}
                contentFit="cover"
                contentPosition={illustration ? 'center' : 'top'}
                transition={illustration ? 200 : 0}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(8,3,15,0.55)', 'rgba(8,3,15,0.04)', 'rgba(8,3,15,0.30)', 'rgba(9,4,19,0.92)']}
              locations={[0, 0.3, 0.56, 0.9]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(9,4,19,0)', background]}
              style={styles.heroFade}
            />
            <View style={styles.heroCopy}>
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
                <MarkdownText style={[styles.prose, { color: noctalia.text.primary }]}>
                  {paragraphs.join('\n\n')}
                </MarkdownText>
              </Section>
            ) : null}

            {extended?.variations && extended.variations.length > 0 ? (
              <Section label={t('symbols.variations')} noctalia={noctalia}>
                {extended.variations.map((variation) => (
                  <VariationRow
                    key={`${variation.context}-${variation.meaning}`}
                    variation={variation}
                    noctalia={noctalia}
                  />
                ))}
              </Section>
            ) : null}

            {content.askYourself.length > 0 ? (
              <Section label={t('symbols.ask_yourself')} noctalia={noctalia}>
                {content.askYourself.map((question, index) => (
                  <View key={`${question}-${index}`} style={styles.askRow}>
                    <Text style={[styles.askNumber, { color: noctalia.accent.text }]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
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
                {relatedSymbols.map((related) => (
                  <RelatedRow key={related.id} symbol={related} lang={lang} noctalia={noctalia} />
                ))}
              </Section>
            ) : null}
          </View>
        </Animated.ScrollView>

        <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.topBarFill, { backgroundColor: background, borderBottomColor: noctalia.surface.border }, barStyle]}
          />
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
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <View style={[styles.eyebrowRule, { backgroundColor: noctalia.accent.text }]} />
        <Text accessibilityRole="header" style={[styles.eyebrow, { color: noctalia.accent.text }]}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function VariationRow({ variation, noctalia }: { variation: SymbolVariation; noctalia: Tokens }) {
  return (
    <View style={[styles.variationRow, { borderTopColor: noctalia.surface.border }]}>
      <Text selectable style={[styles.variationContext, { color: noctalia.text.primary }]}>
        {variation.context}
      </Text>
      <MarkdownText selectable style={[styles.variationMeaning, { color: noctalia.text.secondary }]}>
        {variation.meaning}
      </MarkdownText>
    </View>
  );
}

function RelatedRow({ symbol, lang, noctalia }: { symbol: DreamSymbol; lang: SymbolLanguage; noctalia: Tokens }) {
  const content = symbol[lang] ?? symbol.en;
  const illustration = getSymbolIllustration(symbol.id);
  return (
    <Pressable
      onPress={() => router.replace(`/symbol-detail/${symbol.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={content.name}
      style={({ pressed }) => [styles.relatedRow, { borderTopColor: noctalia.surface.border }, pressed && styles.pressed]}
    >
      <View style={[styles.relatedThumb, { backgroundColor: noctalia.surface.soft }]}>
        {illustration ? <Image source={illustration} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={styles.relatedCopy}>
        <Text style={[styles.relatedName, { color: noctalia.text.primary }]}>{content.name}</Text>
        <Text style={[styles.relatedCategory, { color: noctalia.text.tertiary }]}>
          {getCategoryName(symbol.category, lang)}
        </Text>
      </View>
      <IconSymbol name="arrow.right" size={16} color={noctalia.accent.text} />
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
  lede: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24 },
  body: { paddingHorizontal: 24, paddingTop: 12, gap: 44 },
  section: { gap: 4 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  eyebrowRule: { width: 22, height: 1 },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  prose: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 28 },
  variationRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, gap: 6 },
  variationContext: { fontFamily: Fonts.fraunces.medium, fontSize: 19, lineHeight: 25 },
  variationMeaning: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 23 },
  askRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 10 },
  askNumber: { fontFamily: Fonts.fraunces.medium, fontSize: 20, lineHeight: 28, fontVariant: ['tabular-nums'] },
  askText: { flex: 1, fontFamily: Fonts.lora.regularItalic, fontSize: 17, lineHeight: 27 },
  relatedRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  relatedThumb: { width: 52, height: 52, borderRadius: 10, borderCurve: 'continuous', overflow: 'hidden' },
  relatedCopy: { flex: 1, gap: 2 },
  relatedName: { fontFamily: Fonts.fraunces.medium, fontSize: 18, lineHeight: 24 },
  relatedCategory: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 18 },
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
  topBarFill: { borderBottomWidth: StyleSheet.hairlineWidth },
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
  barTitle: { flex: 1, fontFamily: Fonts.fraunces.medium, fontSize: 18, lineHeight: 24, paddingRight: 44, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
