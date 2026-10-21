import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { DREAM_TRANSCRIPT_MAX_CHARS } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLocaleNumber } from '@/lib/dateUtils';
import { shouldShowDreamLengthCounter } from '@/lib/dreamTextLimit';
import { getFormattingLocale } from '@/lib/locale';

/** A dream's count against its maximum length, or null while the dream is far from it. */
export function useDreamLengthLabel(length: number): { text: string; accessibilityLabel?: string } | null {
  const { t, currentLang } = useTranslation();
  if (!shouldShowDreamLengthCounter(length)) return null;
  const locale = getFormattingLocale(currentLang);
  const params = {
    count: formatLocaleNumber(length, locale),
    max: formatLocaleNumber(DREAM_TRANSCRIPT_MAX_CHARS, locale),
  };
  return length === DREAM_TRANSCRIPT_MAX_CHARS
    ? { text: t('recording.length.reached', params) }
    : { text: t('recording.length.near', params), accessibilityLabel: t('recording.length.near_accessibility', params) };
}

/** A discreet count that appears only near a dream's maximum length. */
export function DreamLengthCounter({ length, style, testID = 'dream-length-counter' }: {
  length: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const label = useDreamLengthLabel(length);
  const { colors, mode } = useTheme();
  if (!label) return null;
  return (
    <Text
      testID={testID}
      accessibilityLabel={label.accessibilityLabel}
      style={[styles.counter, { color: getNoctaliaDesignTokens(colors, mode).text.secondary }, style]}
    >
      {label.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  counter: { fontFamily: Fonts.outfit.regular, fontSize: 13, lineHeight: 18, textAlign: 'right' },
});
