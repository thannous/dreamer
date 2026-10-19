import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { DURATION, Reveal } from '@/components/motion';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useDreamsData } from '@/context/DreamsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { markPerformance, markPerformanceAfterFrames, performanceTraceId } from '@/lib/performanceTrace';
import { getSymbolIndex, isNewPersonalSymbol, readingSymbols } from '@/lib/symbolLinks';
import { TID } from '@/lib/testIDs';
import { useIsDecorativeCopy, useLiveTestID } from './DecorativeCopy';
import { BookOrnament, BookSectionMark, BookSubheading, useBookBody } from './JournalBook';
import type { DreamAnalysis } from '@/lib/types';
import { DreamReadingWait } from './story/DreamReadingWait';
import { DreamSymbolConstellation, MAX_CONSTELLATION_STARS } from './story/DreamSymbolConstellation';
import { DREAM_STORY, chaptersDelay, reducedDelay } from './story/dreamStoryMotion';
import { DreamSymbolEntry } from './symbols/DreamSymbolEntry';
import { DreamSymbolSheet } from './symbols/DreamSymbolSheet';

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
 * opened by an ornament. Each symbol is followed through the journal: it opens its page,
 * with the dreams it went through.
 */
export function DreamAnalysisContent({ dream, pending, reveal = false, onLayout }: {
  dream: DreamAnalysis;
  pending: boolean;
  /** The reading landed while this screen was watching: play the reveal once. */
  reveal?: boolean;
  onLayout?: ViewProps['onLayout'];
}) {
  const { t, currentLang } = useTranslation();
  const reduced = useReducedMotion();
  const { dreams } = useDreamsData();
  const symbolIndex = useMemo(() => getSymbolIndex(dreams, currentLang), [currentLang, dreams]);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const tid = useLiveTestID();
  const decorative = useIsDecorativeCopy();
  const body = useBookBody();
  const question = useBookBody(true);
  const symbols = readingSymbols(dream.symbols, symbolIndex);
  const stars = symbols.map(({ insight, linked }) => ({
    name: insight.name.trim(),
    count: linked?.appearances.length ?? 1,
    fresh: linked ? isNewPersonalSymbol(linked) : false,
    symbol: linked,
  }));
  const emotions = dream.emotions?.map(item => ({ name: item.name, text: item.insight }));
  const firstChapter = stars.length
    ? chaptersDelay(Math.min(stars.length, MAX_CONSTELLATION_STARS))
    : DREAM_STORY.revealLead;
  // Under reduce motion the chapters fade in together with the constellation, without the sequence.
  const chapterDelay = (index: number) => {
    const delay = firstChapter + index * CHAPTER_STEP_MS;
    return reduced ? reducedDelay(delay) : delay;
  };
  const revealDelay = reveal ? (reduced ? reducedDelay(firstChapter) : firstChapter) : 0;
  useEffect(() => {
    if (decorative || pending || !dream.analysisRequestId) return;
    const details = { trace: performanceTraceId(dream.analysisRequestId), reveal_delay_ms: revealDelay };
    markPerformance('analysis.text_committed', details);
    return markPerformanceAfterFrames('analysis.reveal_window_elapsed', details,
      reveal ? revealDelay + DURATION.normal : 0);
  }, [decorative, pending, dream.analysisRequestId, reveal, revealDelay]);
  const quote = dream.shareableQuote?.trim();

  return (
    <View testID={tid(TID.Component.DreamDetailReadingZone)} onLayout={onLayout} className="mx-2 mb-8 gap-5">
      <BookSectionMark label={t('journal.detail.zone.reading')} testID={tid(TID.Text.DreamDetailReadingZone)} />
      {pending ? (
        <DreamReadingWait />
      ) : (
        <>
          {stars.length ? (
            <DreamSymbolConstellation stars={stars} play={reveal} onOpen={decorative ? undefined : setOpenSymbol} />
          ) : null}
          <Chapter reveal={reveal} delay={chapterDelay(0)}>
            <MarkdownText variant="reading" style={body}>{dream.interpretation ?? ''}</MarkdownText>
          </Chapter>
          {symbols.length ? (
            <Chapter reveal={reveal} delay={chapterDelay(1)} className="mt-3 gap-5">
              <BookSubheading>{t('journal.detail.symbols_header')}</BookSubheading>
              {symbols.map(({ insight, linked }, index) => (
                <DreamSymbolEntry key={`${insight.name}-${index}`} insight={insight} symbol={linked} index={symbolIndex}
                  body={body} onOpen={decorative ? undefined : setOpenSymbol} />
              ))}
            </Chapter>
          ) : null}
          {emotions?.length ? (
            <Chapter reveal={reveal} delay={chapterDelay(2)} className="mt-3 gap-4">
              <BookSubheading>{t('journal.detail.emotions_header')}</BookSubheading>
              {emotions.map((item, index) => (
                <View key={`${item.name}-${index}`} className="gap-1">
                  <Text className="shrink font-serif-bold-italic text-[17px] leading-6 text-ivory">{item.name}</Text>
                  <MarkdownText variant="reading" style={body}>{item.text}</MarkdownText>
                </View>
              ))}
            </Chapter>
          ) : null}
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
      {decorative ? null : (
        <DreamSymbolSheet index={symbolIndex} dream={dream} linkKey={openSymbol}
          onSelect={setOpenSymbol} onClose={() => setOpenSymbol(null)} />
      )}
    </View>
  );
}
