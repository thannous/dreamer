import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  title: string;
  testID: string;
  contentClassName?: string;
};

/** Consistent inset groups; the heading stays outside the interactive surface. */
export function SettingsSection({ children, title, testID, contentClassName = 'px-4' }: Props) {
  return (
    <View className="w-full gap-2" testID={testID}>
      <Text accessibilityRole="header" className="px-1 font-display-semibold text-[18px] leading-[24px] text-ivory">
        {title}
      </Text>
      <View className={`w-full overflow-hidden rounded-[18px] border border-line-strong bg-ink-raised ${contentClassName}`}>
        {children}
      </View>
    </View>
  );
}
