import React, { memo, useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { TodayState, TodayStateId } from '@/lib/todayState';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TodayCardProps = {
  state: TodayState | null;
  onPressCta: () => void;
  animateOnMount?: boolean;
};

const STATE_ICONS: Record<TodayStateId, IconName> = {
  draft_resume: 'square.and.pencil',
  empty: 'moon.stars.fill',
  capture_due: 'moon.stars.fill',
  continue_today: 'sparkles',
  optional_deepen: 'sparkles',
  rest: 'book.closed.fill',
};

export const TodayCard = memo(function TodayCard({
  state,
  onPressCta,
  animateOnMount = false,
}: TodayCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const copyKey = state?.id ?? 'loading';
  const iconName = state ? STATE_ICONS[state.id] : 'moon.stars.fill';

  const cardStyle = useMemo<ViewStyle>(
    () => ({
      borderRadius: 26,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: noctalia.surface.raised,
      borderColor: noctalia.surface.border,
    }),
    [noctalia.surface.border, noctalia.surface.raised],
  );

  return (
    <FlatGlassCard
      intensity="strong"
      style={cardStyle}
      animateOnMount={animateOnMount}
      testID={TID.Component.HomeToday}
      accessibilityLabel={`${t(`home.today.${copyKey}.title`)}. ${t(`home.today.${copyKey}.body`)}`}
    >
      <View className="ml-6 mt-[22px] h-[3px] w-[52px] rounded-[2px] bg-champagne" />
      <View className="px-6 pb-6 pt-3.5">
        <View className="mb-3 flex-row items-center gap-2.5">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[15px] bg-ink-soft">
            <IconSymbol name={iconName} size={16} color={noctalia.accent.text} />
          </View>
          <Text className="font-sans-bold text-[12px] uppercase tracking-[1.4px] text-champagne-on">
            {t('home.today.eyebrow')}
          </Text>
        </View>

        <Text
          className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory"
          testID={TID.Text.HomeTodayTitle}
        >
          {t(`home.today.${copyKey}.title`)}
        </Text>
        <Text
          className="font-sans text-[15px] leading-[22px] text-ivory-muted"
          testID={TID.Text.HomeTodayBody}
        >
          {t(`home.today.${copyKey}.body`)}
        </Text>
        <Text
          testID={TID.Text.HomeTodayState}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-px w-px overflow-hidden opacity-0"
        >
          {state?.id ?? 'loading'}
        </Text>

        {state ? (
          <PressableScale
            onPress={onPressCta}
            accessibilityRole="button"
            accessibilityLabel={t(`home.today.${state.id}.cta`)}
            testID={TID.Button.HomeTodayCta}
            className="mt-[18px] min-h-[50px] flex-row items-center justify-center gap-2 rounded-full border border-champagne-soft bg-champagne px-5 py-[13px] dark:bg-ink-active"
          >
            <Text
              className="min-w-0 flex-1 text-center font-sans-bold text-[15px] text-on-champagne dark:text-champagne-on"
            >
              {t(`home.today.${state.id}.cta`)}
            </Text>
            <Text className="shrink-0 font-sans-bold text-[15px] text-on-champagne dark:text-champagne-on">
              →
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </FlatGlassCard>
  );
});
