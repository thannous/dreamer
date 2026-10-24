import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

/**
 * The dream page's one way to edit it, set among the page's last actions, beside delete.
 * Without `onEdit` it is only printed, as on a page being turned to.
 */
export function JournalEditLink({ onEdit, disabled = false }: {
  onEdit?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const accent = useMemo(() => getNoctaliaDesignTokens(colors, mode).accent.text, [colors, mode]);
  const label = (
    <>
      <IconSymbol name="pencil" size={16} color={accent} />
      <Text className="font-serif-italic text-[15px] text-champagne-on">
        {t('journal.detail.edit_page')}
      </Text>
    </>
  );
  return onEdit ? (
    <PressableScale onPress={onEdit} disabled={disabled} testID={TID.Button.EditDream} accessibilityRole="button"
      accessibilityLabel={t('journal.detail.edit_page_accessibility')} accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={`min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 px-3 ${disabled ? 'opacity-70' : ''}`}>
      {label}
    </PressableScale>
  ) : (
    <View className="min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 px-3">{label}</View>
  );
}
