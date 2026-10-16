import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BookStar } from '@/components/journal/JournalBook';
import { useJournalPageTurns, type JournalPageTurns } from '@/components/journal/journalPageTurns';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The page's number at its foot, as in a book, in italics between two small stars.
 * Decorative: the page is not read by it. On a page that can be turned (`turns`), the
 * turns sit either side of it, at the end of the page rather than over it, for whoever
 * cannot swipe.
 */
export function JournalFolio({ folio, className = '', turns }: {
  folio?: number;
  className?: string;
  turns?: JournalPageTurns['page'];
}) {
  const pageTurns = useJournalPageTurns(turns ?? 'dream');
  const number = folio ? (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      className="flex-row items-center gap-2.5">
      <BookStar size={2.5} opacity={0.6} />
      <Text allowFontScaling={false} className="text-center text-[14px] text-ivory-muted" style={{ fontFamily: Fonts.lora.regularItalic }}>
        {folio}
      </Text>
      <BookStar size={2.5} opacity={0.6} />
    </View>
  ) : null;
  if (!turns || !pageTurns || (!pageTurns.previous && !pageTurns.next)) {
    return number ? <View className={className}>{number}</View> : null;
  }
  return (
    <View className={`flex-row items-center justify-center gap-3 ${className}`}>
      <FolioTurn forward={false} turns={pageTurns} />
      {number}
      <FolioTurn forward turns={pageTurns} />
    </View>
  );
}

function FolioTurn({ forward, turns }: { forward: boolean; turns: JournalPageTurns }) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  // A missing side keeps its place, so the number stays centred.
  if (!(forward ? turns.next : turns.previous)) return <View style={{ width: 44, height: 44 }} />;
  return (
    <Pressable onPress={() => turns.turn(forward)} disabled={turns.locked}
      accessibilityRole="button" accessibilityLabel={t(forward ? 'journal.page.next' : 'journal.page.previous')}
      accessibilityState={{ disabled: turns.locked }}
      testID={forward ? 'journal.page.next' : 'journal.page.previous'}
      hitSlop={4}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: turns.locked ? 0.4 : 1 }}>
      <IconSymbol name={forward ? 'chevron.right' : 'chevron.left'} size={16} color={noctalia.text.secondary} />
    </Pressable>
  );
}
