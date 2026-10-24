import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, type ViewProps } from 'react-native';
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
import { DreamSymbolConstellation } from './story/DreamSymbolConstellation';
import { DreamSymbolEntry } from './symbols/DreamSymbolEntry';
import { DreamSymbolSheet } from './symbols/DreamSymbolSheet';

/** Ready text is readable immediately; the decorative constellation has its own timeline. */
function Chapter({ className, testID, onLayout, children }: {
  className?: string;
  testID?: string;
  onLayout?: ViewProps['onLayout'];
  children: React.ReactNode;
}) {
  return <View className={className} testID={testID} onLayout={onLayout}>{children}</View>;
}

/**
 * The dream's own line, as the reading ends on it: set apart like the last page of a
 * chapter, centred under an ornament. On two facing pages it stands under the dream's name
 * on the left-hand page instead, set as an epigraph (`align="start"`).
 */
export function DreamQuote({ dream, align = 'center', className = '' }: {
  dream: DreamAnalysis;
  align?: 'center' | 'start';
  className?: string;
}) {
  const { t } = useTranslation();
  const tid = useLiveTestID();
  const quote = dream.shareableQuote?.trim();
  if (!quote) return null;
  const centred = align === 'center';
  return (
    <View className={`gap-3 ${centred ? 'items-center px-2' : 'items-start'} ${className}`}>
      {centred ? <BookOrnament /> : <View accessible={false} className="h-px w-8 bg-champagne opacity-40" />}
      <Text testID={tid(TID.Text.DreamDetailQuote)}
        className={`font-serif-italic text-[18px] leading-7 text-ivory ${centred ? 'text-center' : ''}`}>{`« ${quote} »`}</Text>
      {isPoeticDreamQuote(dream) ? (
        <Text className={`font-serif-italic text-[13px] text-ivory-muted ${centred ? 'text-center' : ''}`}>
          {t('journal.detail.quote_attribution')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The complete saved reading belongs to the dream, including its reflection prompts.
 * It is Act II of the dream story: a waiting state while the analysis runs, then the
 * dream's symbols as a constellation and the reading in chapters, ending on its quote.
 * It is set as the rest of the page is, as a book: serif body text, justified, and parts
 * opened by an ornament. Each symbol is followed through the journal: it opens its page,
 * with the dreams it went through.
 */
export function DreamAnalysisContent({ dream, pending, reveal = false, withQuote = true, onLayout, onInterpretationLayout }: {
  dream: DreamAnalysis;
  pending: boolean;
  /** The reading ends on the dream's quote, unless the page sets it elsewhere (beside its name). */
  withQuote?: boolean;
  /** The reading landed while this screen was watching: play the reveal once. */
  reveal?: boolean;
  onLayout?: ViewProps['onLayout'];
  /** Position of ready text within this reading, independent of decorative stars. */
  onInterpretationLayout?: ViewProps['onLayout'];
}) {
  const { t, currentLang } = useTranslation();
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
  useEffect(() => {
    if (decorative || pending || !dream.analysisRequestId) return;
    const details = { trace: performanceTraceId(dream.analysisRequestId), reveal_delay_ms: 0 };
    markPerformance('analysis.text_committed', details);
    return markPerformanceAfterFrames('analysis.reveal_window_elapsed', details);
  }, [decorative, pending, dream.analysisRequestId]);

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
          <Chapter testID={tid('component.dreamDetail.interpretation')} onLayout={onInterpretationLayout}>
            <MarkdownText variant="reading" style={body}>{dream.interpretation ?? ''}</MarkdownText>
          </Chapter>
          {symbols.length ? (
            <Chapter className="mt-3 gap-5">
              <BookSubheading>{t('journal.detail.symbols_header')}</BookSubheading>
              {symbols.map(({ insight, linked }, index) => (
                <DreamSymbolEntry key={`${insight.name}-${index}`} insight={insight} symbol={linked} index={symbolIndex}
                  body={body} onOpen={decorative ? undefined : setOpenSymbol} />
              ))}
            </Chapter>
          ) : null}
          {emotions?.length ? (
            <Chapter className="mt-3 gap-4">
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
            <Chapter className="mt-3">
              <View testID={tid(TID.Component.DreamDetailReflectionZone)} className="gap-3">
                <BookSubheading>{t('journal.detail.reflection_header')}</BookSubheading>
                {dream.reflectionQuestions.map((item, index) => (
                  <MarkdownText key={`${index}-${item}`} variant="reading" style={question}>{`${index + 1}. ${item}`}</MarkdownText>
                ))}
              </View>
            </Chapter>
          ) : null}
          {withQuote && dream.shareableQuote?.trim() ? (
            <Chapter className="mt-4">
              <DreamQuote dream={dream} />
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
