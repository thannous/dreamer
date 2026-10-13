import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

/** The running head's line, and the white space it leaves before the page's text. */
export const RUNNING_HEAD_HEIGHT = 44;
export const RUNNING_HEAD_GAP = 20;

/**
 * The line printed at the top of a journal page, as in a book: the journal's name on the
 * inner side, the way back to it, and the page's number on the outer side. It belongs to
 * the page and scrolls away with it. Without `onBack` it is only printed, as on a page
 * being turned to.
 */
export function JournalRunningHead({ folio, onBack, testID, backTestID }: {
  /** This dream's place in the journal, counted from the first dream written. */
  folio?: number;
  onBack?: () => void;
  testID?: string;
  backTestID?: string;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const title = (
    <>
      <IconSymbol name="chevron.left" size={13} color={noctalia.text.secondary} />
      <Text allowFontScaling={false} className="font-sans-medium text-[12px] uppercase tracking-[2px] text-ivory-muted">
        {t('nav.journal')}
      </Text>
    </>
  );

  return (
    <View testID={testID} className="flex-row items-center justify-between px-3" style={{ height: RUNNING_HEAD_HEIGHT }}>
      {onBack ? (
        <PressableScale onPress={onBack} testID={backTestID} accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="min-h-11 flex-row items-center gap-2 px-3">
          {title}
        </PressableScale>
      ) : (
        <View className="min-h-11 flex-row items-center gap-2 px-3">{title}</View>
      )}
      {folio ? (
        <Text allowFontScaling={false} accessible={false} className="px-3 text-[13px] text-ivory-muted"
          style={{ fontFamily: Fonts.lora.regular }}>
          {folio}
        </Text>
      ) : null}
    </View>
  );
}
