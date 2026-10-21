import React, { useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

/** The running head's line, and the white space it leaves before the page's text. */
export const RUNNING_HEAD_HEIGHT = 44;
export const RUNNING_HEAD_GAP = 20;
const BACK_SIZE = 42;

/**
 * The top of a journal page: the way back to the journal, the round arrow the app's other
 * pages use. It belongs to the page and scrolls away with it. Without `onBack` it is only
 * drawn, as on a page being turned to. A `label` is printed across it in spaced capitals,
 * as a book prints its title at the head of each page; it is decorative. An `aside`, such
 * as the full moon's seal, sits at the line's other end.
 */
export function JournalRunningHead({ onBack, testID, backTestID, label, aside }: {
  onBack?: () => void;
  testID?: string;
  backTestID?: string;
  label?: string;
  aside?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const button = [shadows.sm, {
    width: BACK_SIZE, height: BACK_SIZE, borderRadius: BACK_SIZE / 2, borderWidth: 1,
    backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border,
  }];
  const arrow = <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />;

  return (
    <View testID={testID} className="flex-row items-center px-4" style={{ height: RUNNING_HEAD_HEIGHT }}>
      {label ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center"
          style={{ paddingHorizontal: BACK_SIZE + 24 }}>
          <Text allowFontScaling={false} accessible={false} importantForAccessibility="no" numberOfLines={1}
            style={{ fontFamily: Fonts.lora.regular, fontSize: 11, lineHeight: 16, letterSpacing: 3 }}
            className="uppercase text-ivory-muted">
            {label}
          </Text>
        </View>
      ) : null}
      {onBack ? (
        <PressableScale onPress={onBack} testID={backTestID} accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          className="items-center justify-center" style={button}>
          {arrow}
        </PressableScale>
      ) : (
        <View className="items-center justify-center" style={button}>{arrow}</View>
      )}
      {aside ? <View className="ml-auto">{aside}</View> : null}
    </View>
  );
}
