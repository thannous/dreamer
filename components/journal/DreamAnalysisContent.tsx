import React, { useEffect } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Reveal } from '@/components/motion';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { markPerformance, performanceTraceId } from '@/lib/performanceTrace';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { DreamReadingWait } from './story/DreamReadingWait';
import { DreamSymbolConstellation, MAX_CONSTELLATION_STARS } from './story/DreamSymbolConstellation';
import { DREAM_STORY, chaptersDelay, reducedDelay } from './story/dreamStoryMotion';

/** Chapters follow one another slowly enough to read as a sequence, not as a list loading. */
const CHAPTER_STEP_MS = 160;

/** A chapter of the reading: revealed once when the reading has just landed, otherwise at rest. */
function Chapter({ reveal, delay, className, children }: {
  reveal: boolean;
  delay: number;
  className?: string;
  children: React.ReactNode;
}) {
  return reveal
    ? <Reveal delay={delay} className={className}>{children}</Reveal>
    : <View className={className}>{children}</View>;
}

/**
 * The complete saved reading belongs to the dream, including its reflection prompts.
 * It is Act II of the dream story: a waiting state while the analysis runs, then the
 * dream's symbols as a constellation and the reading in chapters, ending on its quote.
 */
export function DreamAnalysisContent({ dream, pending, reveal = false, onLayout }: {
  dream: DreamAnalysis;
  pending: boolean;
  /** The reading landed while this screen was watching: play the reveal once. */
  reveal?: boolean;
  onLayout?: ViewProps['onLayout'];
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!pending && dream.analysisRequestId) {
      markPerformance('analysis.text_displayed', { trace: performanceTraceId(dream.analysisRequestId) });
    }
  }, [pending, dream.analysisRequestId]);
  const body = { fontSize: 16, lineHeight: 26, color: colors.textPrimary };
  const insights = [
    { key: 'symbols', heading: t('journal.detail.symbols_header'), items: dream.symbols?.map(item => ({ name: item.name, text: item.meaning })) },
    { key: 'emotions', heading: t('journal.detail.emotions_header'), items: dream.emotions?.map(item => ({ name: item.name, text: item.insight })) },
  ];
  const symbolNames = (dream.symbols ?? [])
    .map(item => item.name?.trim())
    .filter((name): name is string => Boolean(name));
  const firstChapter = symbolNames.length
    ? chaptersDelay(Math.min(symbolNames.length, MAX_CONSTELLATION_STARS))
    : DREAM_STORY.revealLead;
  // Under reduce motion the chapters fade in together with the constellation, without the sequence.
  const chapterDelay = (index: number) => {
    const delay = firstChapter + index * CHAPTER_STEP_MS;
    return reduced ? reducedDelay(delay) : delay;
  };
  const quote = dream.shareableQuote?.trim();

  return (
    <View testID={TID.Component.DreamDetailReadingZone} onLayout={onLayout} className="mx-2 mb-8 gap-5">
      <Text accessibilityRole="header" testID={TID.Text.DreamDetailReadingZone} className="font-sans-bold text-[18px] text-ivory">
        {t('journal.detail.zone.reading')}
      </Text>
      {pending ? (
        <DreamReadingWait />
      ) : (
        <>
          {symbolNames.length ? <DreamSymbolConstellation names={symbolNames} play={reveal} /> : null}
          <Chapter reveal={reveal} delay={chapterDelay(0)}>
            <MarkdownText variant="reading" style={body}>{dream.interpretation ?? ''}</MarkdownText>
          </Chapter>
          {insights.map((section, sectionIndex) => section.items?.length ? (
            <Chapter key={section.key} reveal={reveal} delay={chapterDelay(sectionIndex + 1)} className="mt-3 gap-4">
              <Text accessibilityRole="header" className="font-display-medium text-[20px] leading-7 text-ivory">{section.heading}</Text>
              {section.items.map((item, index) => (
                <View key={`${item.name}-${index}`} className="gap-1">
                  <View className="flex-row items-center gap-2">
                    {section.key === 'symbols' ? <View className="h-1.5 w-1.5 rounded-full bg-champagne" /> : null}
                    <Text className="shrink font-sans-bold text-[16px] leading-6 text-ivory">{item.name}</Text>
                  </View>
                  <MarkdownText variant="reading" style={body}>{item.text}</MarkdownText>
                </View>
              ))}
            </Chapter>
          ) : null)}
          {dream.reflectionQuestions?.length ? (
            <Chapter reveal={reveal} delay={chapterDelay(3)} className="mt-3">
              <View testID={TID.Component.DreamDetailReflectionZone} className="gap-3">
                <Text accessibilityRole="header" className="font-display-medium text-[20px] leading-7 text-ivory">{t('journal.detail.reflection_header')}</Text>
                {dream.reflectionQuestions.map((question, index) => (
                  <MarkdownText key={`${index}-${question}`} variant="reading" style={body}>{`${index + 1}. ${question}`}</MarkdownText>
                ))}
              </View>
            </Chapter>
          ) : null}
          {quote ? (
            // The reading ends on the dream's own line, set apart like the last page of a chapter.
            <Chapter reveal={reveal} delay={chapterDelay(4)} className="mt-4 items-center gap-3 px-2">
              <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
                className="flex-row items-center gap-2">
                <View className="h-px w-8 bg-champagne opacity-40" />
                <View className="h-1.5 w-1.5 rounded-full bg-champagne" />
                <View className="h-px w-8 bg-champagne opacity-40" />
              </View>
              <Text testID={TID.Text.DreamDetailQuote} className="text-center font-serif-italic text-[18px] leading-7 text-ivory">{`« ${quote} »`}</Text>
              {isPoeticDreamQuote(dream) ? <Text className="text-center font-sans text-[12px] text-ivory-muted">{t('journal.detail.quote_attribution')}</Text> : null}
            </Chapter>
          ) : null}
        </>
      )}
    </View>
  );
}
