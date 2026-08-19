import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  /**
   * @deprecated Colours come from the theme via `className` now. Still accepted so
   * callers that pass it keep compiling; the value is ignored.
   */
  colors?: ReturnType<typeof useTheme>['colors'];
  icon?: IconName;
};

export function SectionHeading({ title, subtitle, icon }: SectionHeadingProps) {
  const { colors, mode } = useTheme();
  // `IconSymbol` takes a colour value, not a style, so the accent stays in TS.
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <View className="mb-[18px]">
      <View className="flex-row items-center gap-2">
        {icon && (
          <View className="h-[26px] w-[26px] items-center justify-center rounded-sm border-[length:hairlineWidth()] border-line bg-ink-soft">
            <IconSymbol name={icon} size={14} color={noctalia.accent.text} />
          </View>
        )}
        <Text className="font-display-semibold text-[22px] text-ivory">{title}</Text>
      </View>
      {subtitle ? (
        <Text className="mt-1.5 font-sans text-body-sm text-ivory-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
