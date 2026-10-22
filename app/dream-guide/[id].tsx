import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { BOOK_MEASURE } from '@/components/journal/JournalBook';
import { SymbolCard } from '@/components/symbols/SymbolCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useGuideReading } from '@/hooks/useGuideReading';
import { guideReadingStatus } from '@/lib/guideReading';
import { getGuideReadingCopy } from '@/lib/guideReadingCopy';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamGuideCopy } from '@/lib/dreamGuideCopy';
import type { DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import {
  getDreamGuideById,
  getDreamGuideContent,
  getDreamGuideIcon,
  getDreamGuideSymbols,
  getGeneralDreamGuides,
  getImportantDreamGuides,
  getPracticalDreamGuideContent,
} from '@/services/dreamGuideService';
import { retryGuideReading, updateGuideReading } from '@/services/guideReadingStore';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { HeaderScrollView, useHeaderScroll } from '@/components/ui/headerStretch';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';
import { TypeScale } from '@/constants/typeScale';

function DreamGuideDetailScreen() {
  // This screen's own scroll, published to its header painting and title.
  const onHeaderScroll = useHeaderScroll();
  const { id, resume: resumeParam } = useLocalSearchParams<{ id?: string | string[]; resume?: string | string[] }>();
  const guideId = Array.isArray(id) ? id[0] : id;
  // Opened from "Resume reading": the guide scrolls to its bookmark once, when laid out.
  const opensAtBookmark = (Array.isArray(resumeParam) ? resumeParam[0] : resumeParam) === '1';
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang, t } = useTranslation();
  const language = (currentLang ?? 'en') as DreamGuideLanguage;
  const copy = getDreamGuideCopy(language);
  const scrollPerf = useScrollIdle();
  const guide = useMemo(() => (guideId ? getDreamGuideById(guideId) : undefined), [guideId]);
  const symbols = useMemo(
    () => (guide?.kind === 'symbols' ? getDreamGuideSymbols(guide) : []),
    [guide],
  );
  const reading = useGuideReading();
  const readingCopy = getGuideReadingCopy(language);
  const progress = guide ? reading.entries[guide.id] : undefined;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sectionPositions = useRef<Record<number, number>>({ 0: 0 });
  const listTop = useRef(0);
  // Sections are measured inside the reading measure, which starts below the artwork.
  const measureTop = useRef(0);
  const resuming = useRef(false);
  const practicalTop = useRef(0);
  const practicalListOffset = useRef(0);
  const itemPositions = useRef<Record<number, number>>({});
  const itemCount = guide?.kind === 'practical' ? getPracticalDreamGuideContent(guide, language).essentialPoints.length : symbols.length;
  const conclusionSection = itemCount + 1;
  useEffect(() => {
    if (guide && reading.ready && !progress) updateGuideReading(reading.scope, guide.id, 0);
  }, [guide, progress, reading.ready, reading.scope]);
  const captureBookmark = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (resuming.current) { resuming.current = false; return; }
    if (!guide || !reading.ready || event.nativeEvent.contentOffset.y <= 20) return;
    const y = event.nativeEvent.contentOffset.y + event.nativeEvent.layoutMeasurement.height / 2 - measureTop.current;
    const positions = { ...sectionPositions.current };
    for (const [index, top] of Object.entries(itemPositions.current)) positions[Number(index)] = listTop.current + top;
    const section = Object.entries(positions).filter(([, top]) => top <= y)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (section) updateGuideReading(reading.scope, guide.id, Number(section));
  }, [guide, reading.ready, reading.scope]);
  const onWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    (onHeaderScroll as (event: NativeSyntheticEvent<NativeScrollEvent>) => void)(event);
    captureBookmark(event);
  }, [captureBookmark, onHeaderScroll]);
  const bookmark = progress?.section ?? 0;
  const resume = useCallback(() => {
    const y = itemPositions.current[bookmark] !== undefined ? listTop.current + itemPositions.current[bookmark] : sectionPositions.current[bookmark] ?? 0;
    resuming.current = Platform.OS === 'web';
    scrollRef.current?.scrollTo({ y: Math.max(0, measureTop.current + y - 20), animated: false });
  }, [bookmark]);
  // The conclusion is laid out last: every section's position is known once it is.
  const [laidOut, setLaidOut] = useState(false);
  const resumedOnArrival = useRef(false);
  const completedAt = progress?.completedAt;
  useEffect(() => {
    if (!opensAtBookmark || !laidOut || !reading.ready || bookmark === 0 || completedAt || resumedOnArrival.current) return;
    resumedOnArrival.current = true;
    requestAnimationFrame(resume);
  }, [bookmark, completedAt, laidOut, opensAtBookmark, reading.ready, resume]);
  // After a completion, the next guide still to finish, in the order of the guides list.
  const nextGuide = useMemo(() => {
    if (!guide) return undefined;
    const order = [...getGeneralDreamGuides(), ...getImportantDreamGuides()];
    const from = order.findIndex(candidate => candidate.id === guide.id);
    return [...order.slice(from + 1), ...order.slice(0, Math.max(0, from))]
      .find(candidate => !reading.entries[candidate.id]?.completedAt);
  }, [guide, reading.entries]);

  if (!guide) {
    return (
      <LinearGradient colors={noctalia.screen.gradient} style={styles.emptyState}>

        <Pressable
          onPress={() => router.back()}
          accessibilityLabel={t('navigation.back')}
          accessibilityRole="button"
          style={[
            styles.emptyBackButton,
            { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
          ]}
        >
          <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
        </Pressable>
        <Text selectable style={[styles.emptyText, { color: noctalia.text.secondary }]}>
          {copy.notFound}
        </Text>
      </LinearGradient>
    );
  }

  const content = getDreamGuideContent(guide, language);
  const practicalContent =
    guide.kind === 'practical' ? getPracticalDreamGuideContent(guide, language) : undefined;

  const exercise = guide.kind === 'practical' ? readingCopy.exercise[guide.id] : undefined;
  const status = guideReadingStatus(progress);
  const exerciseDestination = guide.id === 'understand-dreams' ? '/(tabs)/journal'
    : guide.id === 'remember-dreams' ? '/ritual/memory' : guide.id === 'lucid-dreaming' ? '/ritual/lucid' : '/recording';

  return (
    <ScrollPerfProvider activity={scrollPerf.activity}>
      <LinearGradient
        colors={noctalia.screen.gradient}
        style={styles.container}
        testID="screen.dreamGuideDetail"
      >
        <HeaderScrollView ref={scrollRef} onScroll={Platform.OS === 'web' ? onWebScroll : onHeaderScroll} scrollEventThrottle={16}
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={event => { scrollPerf.onScrollEndDrag(); captureBookmark(event); }}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={event => { scrollPerf.onMomentumScrollEnd(); captureBookmark(event); }}
        >
          <DreamerArtworkWindow scene="path" style={{ marginHorizontal: -16 }} bleedTop={38} />
          {/* A reading measure on a wide window, under the full-width artwork. */}
          <View style={styles.measure} onLayout={event => { measureTop.current = event.nativeEvent.layout.y; }}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => router.back()}
                accessibilityLabel={t('navigation.back')}
                accessibilityRole="button"
                style={[
                  styles.backButton,
                  shadows.sm,
                  {
                    backgroundColor: noctalia.surface.raised,
                    borderColor: noctalia.surface.border,
                  },
                ]}
              >
                <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
              </Pressable>
              <View style={[styles.guideBadgeIcon, { backgroundColor: noctalia.surface.soft }]}>
                <IconSymbol
                  name={getDreamGuideIcon(guide.id)}
                  size={21}
                  color={noctalia.accent.text}
                />
              </View>
              <Text style={[styles.guideLabel, { color: noctalia.accent.text }]}>
                {copy.guideLabel}
              </Text>
            </View>

            <Text selectable style={[styles.title, { color: noctalia.text.primary }]}>
              {content.title}
            </Text>

            {reading.ready ? <View style={styles.statusRow}>
              <View style={[styles.statusChip, { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border }]}>
                {status === 'completed' ? (
                  <View accessible={false}>
                    <IconSymbol name="checkmark.circle.fill" size={15} color={noctalia.accent.text} />
                  </View>
                ) : status === 'inProgress' ? (
                  <View accessible={false} style={[styles.statusDot, { backgroundColor: noctalia.accent.base }]} />
                ) : null}
                <Text testID="guide.reading.status" accessibilityLiveRegion="polite"
                  style={[styles.statusText, { color: status === 'completed' ? noctalia.accent.text : noctalia.text.primary }]}>
                  {readingCopy.status[status]}
                </Text>
              </View>
              {progress && progress.section > 0 && !progress.completedAt ? <Pressable testID="guide.reading.resume" accessibilityRole="button" onPress={resume}
                style={({ pressed }) => [styles.resumeButton, { borderColor: noctalia.surface.border }, pressed && styles.pressed]}>
                <View accessible={false}>
                  <IconSymbol name="book.closed.fill" size={15} color={noctalia.accent.text} />
                </View>
                <Text style={[styles.actionText, { color: noctalia.accent.text }]}>{readingCopy.resume}</Text>
              </Pressable> : null}
            </View> : null}
            {reading.error ? <View style={styles.readingControls}>
              <Text accessibilityRole="alert" style={[styles.conclusionText, { color: noctalia.text.secondary }]}>{readingCopy.pending}</Text>
              <Pressable accessibilityRole="button" onPress={() => { void retryGuideReading(reading.scope); }} style={styles.readingAction}><Text style={{ color: noctalia.accent.text }}>{readingCopy.retry}</Text></Pressable>
            </View> : null}
            <View style={[DecoLines.rule, styles.rule, { backgroundColor: noctalia.accent.base }]} />

            <FlatGlassCard intensity="strong" style={styles.introCard}>
              <Text selectable style={[styles.introText, { color: noctalia.text.primary }]}>
                {content.intro}
              </Text>
            </FlatGlassCard>

            {practicalContent ? (
              <View style={styles.practicalSection} onLayout={event => { practicalTop.current = event.nativeEvent.layout.y; listTop.current = practicalTop.current + practicalListOffset.current; }}>
                <View style={styles.sectionHeadingRow}>
                  <IconSymbol name="checkmark.circle.fill" size={19} color={noctalia.accent.text} />
                  <Text style={[styles.sectionHeading, { color: noctalia.text.primary }]}>
                    {copy.essentialsHeading}
                  </Text>
                </View>
                <View style={styles.practicalList} onLayout={event => { practicalListOffset.current = event.nativeEvent.layout.y; listTop.current = practicalTop.current + practicalListOffset.current; }}>
                  {practicalContent.essentialPoints.map((point, index) => (
                    <View key={index} testID={`guide.section.${index + 1}`} onLayout={event => { itemPositions.current[index + 1] = event.nativeEvent.layout.y; }}>
                    <FlatGlassCard
                      intensity="subtle"
                      style={styles.practicalPointCard}
                    >
                      <View style={[styles.pointIndex, { backgroundColor: noctalia.surface.soft }]}>
                        <Text style={[styles.pointIndexText, { color: noctalia.accent.text }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text
                        selectable
                        testID={`dream-guide-point-${index}`}
                        style={[styles.practicalPointText, { color: noctalia.text.secondary }]}
                      >
                        {point}
                      </Text>
                    </FlatGlassCard>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeadingRow}>
                  <IconSymbol name="book.closed.fill" size={19} color={noctalia.accent.text} />
                  <Text style={[styles.sectionHeading, { color: noctalia.text.primary }]}>
                    {copy.symbolsHeading}
                  </Text>
                  <Text style={[styles.symbolCount, { color: noctalia.text.tertiary }]}>
                    {copy.symbolCount(symbols.length)}
                  </Text>
                </View>

                <View style={styles.symbolList} onLayout={event => { listTop.current = event.nativeEvent.layout.y; }}>
                  {symbols.map((symbol, index) => (
                    <View key={symbol.id} testID={`guide.section.${index + 1}`} onLayout={event => { itemPositions.current[index + 1] = event.nativeEvent.layout.y; }}>
                    <SymbolCard
                      symbol={symbol}
                      language={language}
                      source="guide"
                    />
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={styles.conclusionSection} testID="guide.reading.conclusion" onLayout={event => { sectionPositions.current[conclusionSection] = event.nativeEvent.layout.y; setLaidOut(true); }}>
              <View style={styles.sectionHeadingRow}>
                <IconSymbol name="lightbulb.fill" size={19} color={noctalia.accent.text} />
                <Text style={[styles.sectionHeading, { color: noctalia.text.primary }]}>
                  {copy.conclusionHeading}
                </Text>
              </View>
              <FlatGlassCard intensity="subtle" style={styles.conclusionCard}>
                <Text selectable style={[styles.conclusionText, { color: noctalia.text.secondary }]}>
                  {content.outro}
                </Text>
              </FlatGlassCard>
            </View>
            <View style={styles.readingControls}>
              {progress?.completedAt ? (
                <View testID="guide.reading.completed" accessibilityLiveRegion="polite"
                  style={[styles.completedCard, { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border }]}>
                  <View accessible={false}>
                    <IconSymbol name="checkmark.circle.fill" size={22} color={noctalia.accent.text} />
                  </View>
                  <Text style={[styles.completedText, { color: noctalia.text.primary }]}>{readingCopy.completed}</Text>
                </View>
              ) :
                <Pressable testID="guide.reading.complete" accessibilityRole="button" accessibilityState={{ disabled: !reading.ready }} disabled={!reading.ready}
                  onPress={() => updateGuideReading(reading.scope, guide.id, conclusionSection, true)}
                  style={[styles.readingAction, styles.completeButton, { backgroundColor: noctalia.action.primary, opacity: reading.ready ? 1 : 0.5 }]}>
                  <View accessible={false}>
                    <IconSymbol name="checkmark.circle.fill" size={17} color={noctalia.action.primaryText} />
                  </View>
                  <Text style={[styles.actionText, { color: noctalia.action.primaryText }]}>{readingCopy.complete}</Text>
                </Pressable>}
            </View>
            {exercise ? <View style={styles.conclusionSection} testID="guide.reading.exercise">
              <Text accessibilityRole="header" style={[styles.sectionHeading, { color: noctalia.text.primary }]}>{readingCopy.optional}</Text>
              <Text selectable style={[styles.conclusionText, { color: noctalia.text.secondary }]}>{exercise.body}</Text>
              <Pressable accessibilityRole="button" testID="guide.reading.exercise.action" onPress={() => router.push(exerciseDestination)}
                style={({ pressed }) => [styles.secondaryButton, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }, pressed && styles.pressed]}>
                <Text style={[styles.actionText, styles.secondaryButtonText, { color: noctalia.accent.text }]}>{exercise.action}</Text>
                <View accessible={false}>
                  <IconSymbol name="arrow.right" size={17} color={noctalia.accent.text} />
                </View>
              </Pressable>
            </View> : null}
            {/* Once a guide is finished, the reading goes on: the next guide, or back to them all. */}
            {progress?.completedAt ? (
              <View style={[styles.nextSection, { borderTopColor: noctalia.surface.border }]}>
                {nextGuide ? (
                  <Pressable testID="guide.reading.next" accessibilityRole="button"
                    accessibilityLabel={`${readingCopy.next}. ${getDreamGuideContent(nextGuide, language).title}`}
                    onPress={() => router.replace({ pathname: '/dream-guide/[id]', params: { id: nextGuide.id } })}
                    style={({ pressed }) => [styles.nextCard, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }, pressed && styles.pressed]}>
                    <View accessible={false} style={[styles.guideBadgeIcon, { backgroundColor: noctalia.surface.soft }]}>
                      <IconSymbol name={getDreamGuideIcon(nextGuide.id)} size={19} color={noctalia.accent.text} />
                    </View>
                    <View style={styles.nextCopy}>
                      <Text style={[styles.nextLabel, { color: noctalia.accent.text }]}>{readingCopy.next}</Text>
                      <Text style={[styles.nextTitle, { color: noctalia.text.primary }]}>{getDreamGuideContent(nextGuide, language).title}</Text>
                    </View>
                    <View accessible={false}>
                      <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
                    </View>
                  </Pressable>
                ) : (
                  <>
                    <Text testID="guide.reading.all-done" style={[styles.completedText, { color: noctalia.text.primary }]}>{readingCopy.allDone}</Text>
                    <Pressable testID="guide.reading.back-to-guides" accessibilityRole="button" onPress={() => router.dismissTo('/dream-guides')}
                      style={({ pressed }) => [styles.secondaryButton, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }, pressed && styles.pressed]}>
                      <Text style={[styles.actionText, styles.secondaryButtonText, { color: noctalia.accent.text }]}>{readingCopy.backToGuides}</Text>
                      <View accessible={false}>
                        <IconSymbol name="arrow.right" size={17} color={noctalia.accent.text} />
                      </View>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}
          </View>
        </HeaderScrollView>
      </LinearGradient>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  readingControls: { gap: 8 },
  readingAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 16 },
  measure: { width: '100%', maxWidth: BOOK_MEASURE, alignSelf: 'center', gap: ThemeLayout.spacing.lg20 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  statusChip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.caption.fontSize, lineHeight: 16 },
  resumeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1 },
  actionText: { fontFamily: Fonts.outfit.bold, fontSize: TypeScale.bodySm.fontSize, lineHeight: TypeScale.bodySm.lineHeight },
  completedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: ThemeLayout.spacing.md, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1 },
  completedText: { flex: 1, fontFamily: Fonts.outfit.medium, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  secondaryButtonText: { flexShrink: 1 },
  nextSection: { gap: 12, paddingTop: ThemeLayout.spacing.lg20, borderTopWidth: 1 },
  nextCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1 },
  nextCopy: { flex: 1, minWidth: 0, gap: 3 },
  nextLabel: { fontFamily: Fonts.outfit.bold, fontSize: TypeScale.caption.fontSize, lineHeight: 16, textTransform: 'uppercase' },
  nextTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight },
  pressed: { opacity: 0.82 },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: 38,
    paddingBottom: ThemeLayout.spacing.xl,
    gap: ThemeLayout.spacing.lg20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBadgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideLabel: {
    flex: 1,
    fontFamily: Fonts.outfit.bold,
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: TypeScale.h1.fontSize,
    lineHeight: TypeScale.h1.lineHeight,
  },
  rule: {
    width: 64,
  },
  introCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
  },
  introText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.body.fontSize,
    lineHeight: TypeScale.body.lineHeight,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    flex: 1,
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: TypeScale.h2.fontSize,
    lineHeight: TypeScale.h2.lineHeight,
  },
  symbolCount: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 16,
  },
  symbolList: {
    marginHorizontal: -ThemeLayout.spacing.md,
  },
  practicalSection: {
    gap: 12,
  },
  practicalList: {
    gap: 10,
  },
  practicalPointCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointIndex: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointIndexText: {
    fontFamily: Fonts.outfit.bold,
    fontSize: TypeScale.caption.fontSize,
  },
  practicalPointText: {
    flex: 1,
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 21,
  },
  conclusionSection: {
    gap: 12,
  },
  conclusionCard: {
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
  },
  conclusionText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ThemeLayout.spacing.md,
  },
  emptyBackButton: {
    position: 'absolute',
    top: 38,
    left: ThemeLayout.spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.body.fontSize,
  },
});

export default withHeaderScroll(DreamGuideDetailScreen);
