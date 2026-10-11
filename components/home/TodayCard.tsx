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
  dreamTitle?: string;
};

/** One editorial action, driven by the existing capture/draft/dream state. */
export function TodayCard({ state, onPressCta, dreamTitle }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t } = useTranslation();
  const copyKey = state?.id ?? 'loading';
  const title = dreamTitle?.trim() || t(`home.today.${copyKey}.title`);
  const cta = state?.action.kind === 'open_dream'
    ? t('home.today.resume_dream')
    : state ? t(`home.today.${state.id}.cta`) : '';

  return (
    <View testID={TID.Component.HomeToday} className="px-6 pb-4">
      <Text className="mb-1 font-sans-medium text-[11px] uppercase tracking-[1.8px] text-champagne-on">
        {t(dreamTitle ? 'home.today.dream_eyebrow' : 'home.today.eyebrow')}
      </Text>
      <Text testID={TID.Text.HomeTodayTitle} accessibilityRole="header"
        className="font-display-semibold text-[29px] leading-[32px] text-ivory">
        {title}
      </Text>
      {!dreamTitle ? <Text testID={TID.Text.HomeTodayBody}
        className="mt-2 font-sans text-[15px] leading-[22px] text-ivory-muted">
        {t(`home.today.${copyKey}.body`)}
      </Text> : null}
      <Text testID={TID.Text.HomeTodayState} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants" className="absolute h-px w-px overflow-hidden opacity-0">
        {state?.id ?? 'loading'}
      </Text>
      {state ? <Pressable onPress={onPressCta} accessibilityRole="button"
        accessibilityLabel={cta} testID={TID.Button.HomeTodayCta}
        // Same primary button as the Journal first page.
        className="mt-5 min-h-14 flex-row items-center justify-between gap-3 rounded-[18px] bg-champagne px-5 py-4 active:opacity-80">
        <Text className="min-w-0 flex-1 font-sans-medium text-[16px] leading-[22px] text-on-champagne">{cta}</Text>
        <IconSymbol name="arrow.right" size={22} color={tokens.action.primaryText} />
      </Pressable> : null}
    </View>
  );
}
