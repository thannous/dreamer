import { PressableScale, Reveal } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';

function MoonStarsIcon({ size = 64, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Crescent moon */}
      <Path
        d="M38 8c-1.6 0-3.16.16-4.66.46A20 20 0 0 1 44 28a20 20 0 0 1-10.66 17.54c1.5.3 3.06.46 4.66.46 11.05 0 20-8.95 20-19S49.05 8 38 8z"
        fill={color}
        opacity={0.8}
      />
      {/* Stars */}
      <Circle cx={12} cy={12} r={2} fill={color} opacity={0.6} />
      <Circle cx={22} cy={6} r={1.5} fill={color} opacity={0.4} />
      <Circle cx={8} cy={24} r={1.2} fill={color} opacity={0.5} />
      <Circle cx={16} cy={48} r={1.8} fill={color} opacity={0.35} />
      <Circle cx={6} cy={38} r={1} fill={color} opacity={0.45} />
    </Svg>
  );
}

interface EmptyStateProps {
  /** Whether a filter is currently active (shows different message) */
  hasActiveFilter: boolean;
  onClearFilters?: () => void;
  onStartRememberedDream?: () => void;
}

export function EmptyState({
  hasActiveFilter,
  onClearFilters,
  onStartRememberedDream,
}: EmptyStateProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const showRememberedAction = !hasActiveFilter && !!onStartRememberedDream;

  return (
    // The empty state mounts once, and it is the only thing on screen: an entrance is
    // what tells the user the list finished loading and is genuinely empty.
    <Reveal delay={100}>
      <View className="items-center gap-4 px-6 pt-20">
        <MoonStarsIcon size={64} color={noctalia.text.tertiary} />
        <View className="items-center gap-2">
          <Text className="text-center font-sans text-body text-ivory">
            {hasActiveFilter ? t('journal.empty.filtered') : t('journal.empty.default')}
          </Text>
          {showRememberedAction ? (
            <Text className="max-w-[320px] text-center font-sans text-body-sm text-ivory-muted">
              {t('journal.empty.remembered_hint')}
            </Text>
          ) : null}
        </View>
        {showRememberedAction ? (
          <PressableScale
            className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-continuous border-champagne-soft bg-champagne px-[18px] py-3"
            onPress={onStartRememberedDream}
            accessibilityRole="button"
            accessibilityLabel={t('journal.empty.remembered_cta')}
            testID={TID.Button.EmptyStartRememberedDream}
          >
            <IconSymbol name="pencil" size={18} color={noctalia.action.primaryText} />
            <Text className="text-center font-sans-bold text-[15px] text-on-champagne">
              {t('journal.empty.remembered_cta')}
            </Text>
          </PressableScale>
        ) : null}
        {hasActiveFilter && onClearFilters ? (
          <PressableScale
            className="mt-2 rounded-full border border-continuous border-champagne-soft px-6 py-3"
            onPress={onClearFilters}
            accessibilityRole="button"
            testID={TID.Button.EmptyClearFilters}
          >
            <Text className="font-sans-bold text-[16px] text-champagne-on">
              {t('journal.filter.clear')}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Reveal>
  );
}
