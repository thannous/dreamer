import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { TodayState } from '@/lib/todayState';

type Props = {
  state: TodayState | null;
  onPressCta: () => void;
};

/** One editorial action, driven by the existing capture/draft/dream state, under the hero's headline. */
export function TodayCard({ state, onPressCta }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t } = useTranslation();
  const cta = state ? t(`home.today.${state.id}.cta`) : '';

  return (
    <View testID={TID.Component.HomeToday} className="px-6 pb-4">
      <Text testID={TID.Text.HomeTodayState} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants" className="absolute h-px w-px overflow-hidden opacity-0">
        {state?.id ?? 'loading'}
      </Text>
      {state ? <Pressable onPress={onPressCta} accessibilityRole="button"
        accessibilityLabel={cta} testID={TID.Button.HomeTodayCta}
        // Same primary button as the Journal first page.
        className="min-h-14 flex-row items-center justify-between gap-3 rounded-[18px] bg-champagne px-5 py-4 active:opacity-80">
        <Text className="min-w-0 flex-1 font-sans-medium text-body leading-[22px] text-on-champagne">{cta}</Text>
        <IconSymbol name="arrow.right" size={22} color={tokens.action.primaryText} />
      </Pressable> : null}
    </View>
  );
}
