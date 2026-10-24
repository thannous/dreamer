import React from 'react';
import { Text, View } from 'react-native';

/** Section opening shared with the symbol sheets and noctalia.app: champagne mark, serif title. */
export function TrendsSectionHead({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  /** Sits after the subtitle, on its line when it fits. */
  children?: React.ReactNode;
}) {
  return (
    <View className="gap-1">
      <View className="mb-2 h-[2px] w-7 rounded-full bg-champagne" />
      <Text accessibilityRole="header" className="text-h1 font-display-semibold text-ivory">
        {title}
      </Text>
      {subtitle || children ? (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
          {subtitle ? <Text className="shrink text-body-sm font-sans text-ivory-muted">{subtitle}</Text> : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}
