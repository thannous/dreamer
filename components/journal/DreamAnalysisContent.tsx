import React, { useEffect } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Reveal } from '@/components/motion';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useTranslation } from '@/hooks/useTranslation';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { markPerformance, performanceTraceId } from '@/lib/performanceTrace';
import { TID } from '@/lib/testIDs';
import { useIsDecorativeCopy, useLiveTestID } from './DecorativeCopy';
import { BookOrnament, BookSectionMark, BookStar, BookSubheading, useBookBody } from './JournalBook';
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
 * It is set as the rest of the page is, as a book: serif body text, justified, and parts
 * opened by an ornament.
 */
export function DreamAnalysisContent({ dream, pending, reveal = false, onLayout }: {
  dream: DreamAnalysis;
  pending: boolean;
  /** The reading landed while this screen was watching: play the reveal once. */
  reveal?: boolean;
  onLayout?: ViewProps['onLayout'];
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const tid = useLiveTestID();
  const decorative = useIsDecorativeCopy();
  useEffect(() => {
    if (!decorative && !pending && dream.analysisRequestId) {
      markPerformance('analysis.text_displayed', { trace: performanceTraceId(dream.analysisRequestId) });
    }
  }, [decorative, pending, dream.analysisRequestId]);
  const body = useBookBody();
  const question = useBookBody(true);
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
    <View testID={tid(TID.Component.DreamDetailReadingZone)} onLayout={onLayout} className="mx-2 mb-8 gap-5">
      <BookSectionMark label={t('journal.detail.zone.reading')} testID={tid(TID.Text.DreamDetailReadingZone)} />
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
              <BookSubheading>{section.heading}</BookSubheading>
              {section.items.map((item, index) => (
                <View key={`${item.name}-${index}`} className="gap-1">
                  <View className="flex-row items-center gap-2">
                    {section.key === 'symbols' ? <BookStar size={4} /> : null}
                    <Text className="shrink font-serif-bold-italic text-[17px] leading-6 text-ivory">{item.name}</Text>
                  </View>
                  <MarkdownText variant="reading" style={body}>{item.text}</MarkdownText>
                </View>
              ))}
            </Chapter>
          ) : null)}
          {dream.reflectionQuestions?.length ? (
            <Chapter reveal={reveal} delay={chapterDelay(3)} className="mt-3">
              <View testID={tid(TID.Component.DreamDetailReflectionZone)} className="gap-3">
                <BookSubheading>{t('journal.detail.reflection_header')}</BookSubheading>
                {dream.reflectionQuestions.map((item, index) => (
                  <MarkdownText key={`${index}-${item}`} variant="reading" style={question}>{`${index + 1}. ${item}`}</MarkdownText>
                ))}
              </View>
            </Chapter>
          ) : null}
          {quote ? (
            // The reading ends on the dream's own line, set apart like the last page of a chapter.
            <Chapter reveal={reveal} delay={chapterDelay(4)} className="mt-4 items-center gap-3 px-2">
              <BookOrnament />
              <Text testID={tid(TID.Text.DreamDetailQuote)} className="text-center font-serif-italic text-[18px] leading-7 text-ivory">{`« ${quote} »`}</Text>
              {isPoeticDreamQuote(dream) ? <Text className="text-center font-serif-italic text-[13px] text-ivory-muted">{t('journal.detail.quote_attribution')}</Text> : null}
            </Chapter>
          ) : null}
        </>
      )}
    </View>
  );
}
