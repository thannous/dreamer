import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

/**
 * The dream page's one way to edit it, set on the line of its date, beside what it edits.
 * It keeps to the height of that line, reaching further only for the finger. Without
 * `onEdit` it is only printed, as on a page being turned to.
 */
export function JournalEditLink({ onEdit, disabled = false, lineHeight }: {
  onEdit?: () => void;
  disabled?: boolean;
  lineHeight: number;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const accent = useMemo(() => getNoctaliaDesignTokens(colors, mode).accent.text, [colors, mode]);
  const label = (
    <>
      <IconSymbol name="pencil" size={13} color={accent} />
      <Text allowFontScaling={false} style={{ lineHeight }} className="font-sans-medium text-[13px] text-champagne-on">
        {t('journal.detail.edit_page')}
      </Text>
    </>
  );
  return onEdit ? (
    <PressableScale onPress={onEdit} disabled={disabled} testID={TID.Button.EditDream} accessibilityRole="button"
      accessibilityLabel={t('journal.detail.edit_page_accessibility')} accessibilityState={{ disabled }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      className={`flex-row items-center gap-1.5 ${disabled ? 'opacity-60' : ''}`}>
      {label}
    </PressableScale>
  ) : (
    <View className="flex-row items-center gap-1.5">{label}</View>
  );
}
