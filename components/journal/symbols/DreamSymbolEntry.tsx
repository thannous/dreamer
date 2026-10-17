import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { BookStar } from '@/components/journal/JournalBook';
import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isNewPersonalSymbol, type LinkedSymbol, type SymbolIndex } from '@/lib/symbolLinks';
import { TID } from '@/lib/testIDs';
import type { DreamSymbolInsight } from '@/lib/types';

import { SymbolMedallion } from './SymbolMedallion';
import { symbolStatusLabel } from './symbolStatusLabel';

const FACE = 40;

/**
 * A symbol of the reading, as the reading names it and with what it means in this dream.
 * Linked, it wears its face and says what it has done across the journal, and it opens
 * its page; a symbol the dreamer has not opened yet is marked new and breathes twice,
 * so the eye finds it.
 */
export function DreamSymbolEntry({ insight, symbol, index, body, onOpen }: {
  insight: DreamSymbolInsight;
  symbol: LinkedSymbol | undefined;
  index: SymbolIndex;
  body: StyleProp<TextStyle>;
  /** Absent in a drawn copy of the page, which opens nothing. */
  onOpen?: (linkKey: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const fresh = symbol ? isNewPersonalSymbol(symbol) : false;
  const status = symbol ? symbolStatusLabel(t, symbol, index) : null;
  const newLabel = t('journal.symbols.badge.new');

  const heading = (
    <View className="flex-row items-center gap-3">
      {symbol ? (
        <View className="items-center justify-center" style={{ width: FACE + 4, height: FACE + 4 }}>
          {fresh && onOpen ? <Breath /> : null}
          <SymbolMedallion symbol={symbol} size={FACE} />
        </View>
      ) : <BookStar size={4} />}
      <View className="flex-1 gap-0.5">
        <Text className="font-serif-bold-italic text-[17px] leading-6 text-ivory">{insight.name}</Text>
        {status ? (
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {fresh ? (
              <View className="rounded-full bg-champagne-soft px-2 py-px">
                <Text className="font-sans-medium text-[11px] uppercase leading-4 tracking-[1.2px] text-champagne-on">{newLabel}</Text>
              </View>
            ) : null}
            <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted">{status}</Text>
          </View>
        ) : null}
      </View>
      {onOpen && symbol ? <IconSymbol name="chevron.right" size={14} color={ink.text.tertiary} /> : null}
    </View>
  );

  return (
    <View className="gap-2">
      {onOpen && symbol ? (
        <PressableScale onPress={() => onOpen(symbol.linkKey)} accessibilityRole="button"
          accessibilityLabel={[insight.name, fresh ? newLabel : null, status].filter(Boolean).join(', ')}
          accessibilityHint={t('journal.symbols.open_hint')}
          testID={TID.List.DreamSymbol(symbol.linkKey)}
          className="min-h-11 justify-center">
          {heading}
        </PressableScale>
      ) : heading}
      <MarkdownText variant="reading" style={body}>{insight.meaning}</MarkdownText>
    </View>
  );
}

/** A new symbol's light breathing twice, then resting. */
function Breath() {
  const reduced = useReducedMotion();
  const breathe = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      from: { opacity: 0, transform: [{ scale: 0.95 }] },
      to: { opacity: 0.4, transform: [{ scale: 1.3 }] },
    },
    animationDuration: 1300,
    animationDelay: 600,
    animationIterationCount: 4,
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  }), []);
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" className="absolute bg-champagne"
      style={[{ width: FACE, height: FACE, borderRadius: FACE / 2 }, breathe] as StyleProp<ViewStyle>} />
  );
}
