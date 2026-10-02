import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { markPerformance, performanceTraceId } from '@/lib/performanceTrace';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

/** The complete saved reading belongs to the dream, including its reflection prompts. */
export function DreamAnalysisContent({ dream, pending }: { dream: DreamAnalysis; pending: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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

  return (
    <View testID={TID.Component.DreamDetailReadingZone} className="mx-2 mb-8 gap-5">
      <Text accessibilityRole="header" testID={TID.Text.DreamDetailReadingZone} className="font-sans-bold text-[18px] text-ivory">
        {t('journal.detail.zone.reading')}
      </Text>
      {pending ? (
        <View accessibilityLiveRegion="polite" className="gap-3">
          <Text className="font-sans text-[16px] text-ivory-muted">{t('loading.analyzing')}</Text>
          <View className="h-4 w-full rounded bg-ink-soft" />
          <View className="h-4 w-[90%] rounded bg-ink-soft" />
        </View>
      ) : (
        <>
          <MarkdownText variant="reading" style={body}>{dream.interpretation ?? ''}</MarkdownText>
          {insights.map(section => section.items?.length ? (
            <View key={section.key} className="mt-3 gap-4">
              <Text accessibilityRole="header" className="font-sans-bold text-[17px] text-ivory">{section.heading}</Text>
              {section.items.map((item, index) => (
                <View key={`${item.name}-${index}`} className="gap-1">
                  <Text className="font-sans-bold text-[16px] leading-6 text-ivory">{item.name}</Text>
                  <MarkdownText variant="reading" style={body}>{item.text}</MarkdownText>
                </View>
              ))}
            </View>
          ) : null)}
          {dream.reflectionQuestions?.length ? (
            <View testID={TID.Component.DreamDetailReflectionZone} className="mt-3 gap-3">
              <Text accessibilityRole="header" className="font-sans-bold text-[17px] text-ivory">{t('journal.detail.reflection_header')}</Text>
              {dream.reflectionQuestions.map((question, index) => (
                <MarkdownText key={`${index}-${question}`} variant="reading" style={body}>{`${index + 1}. ${question}`}</MarkdownText>
              ))}
            </View>
          ) : null}
          {dream.shareableQuote?.trim() ? (
            <View className="mt-3 gap-2">
              <Text className="font-sans text-[16px] italic leading-6 text-ivory-muted">{`« ${dream.shareableQuote.trim()} »`}</Text>
              {isPoeticDreamQuote(dream) ? <Text className="font-sans text-[12px] text-ivory-muted">{t('journal.detail.quote_attribution')}</Text> : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
