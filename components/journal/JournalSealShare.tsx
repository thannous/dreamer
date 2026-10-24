import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

/**
 * Share, set between the dream's seal and its reading. Without `onShare` it is only
 * printed, as on a page being turned to.
 */
export function JournalSealShare({ onShare, disabled = false, busy = false }: {
  onShare?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const accent = useMemo(() => getNoctaliaDesignTokens(colors, mode).accent.text, [colors, mode]);
  const label = (
    <>
      {busy ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <IconSymbol name="square.and.arrow.up" size={16} color={accent} />
      )}
      <Text className="font-serif-italic text-[15px] text-ivory">
        {busy ? t('journal.detail.share.button_loading') : t('journal.detail.share.button_default')}
      </Text>
    </>
  );
  return (
    <View className="mb-6 items-center">
      {onShare ? (
        <PressableScale onPress={onShare} disabled={disabled} testID={TID.Button.DreamShareSeal}
          accessibilityRole="button" accessibilityLabel={t('journalDetail.a11y.shareDream')}
          accessibilityState={{ disabled, busy }}
          className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full border border-line px-5 ${disabled ? 'opacity-70' : ''}`}>
          {label}
        </PressableScale>
      ) : (
        <View className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-full border border-line px-5">
          {label}
        </View>
      )}
    </View>
  );
}
