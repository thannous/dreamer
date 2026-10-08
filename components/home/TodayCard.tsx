import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const { colors } = useTheme();
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
        className="mt-2 min-h-[56px] flex-row items-center justify-between gap-4 border-b border-champagne-soft pb-3 pt-2 active:opacity-70">
        <Text className="min-w-0 flex-1 font-display-medium text-[24px] leading-[30px] text-champagne-on">{cta}</Text>
        <IconSymbol name="arrow.right" size={26} color={colors.accentText} />
      </Pressable> : null}
    </View>
  );
}
