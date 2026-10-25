import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  message: string;
  cta: string;
  onPress: () => void;
  testID: string;
  /** The hairline above the row, kept unless the row sits right under a card. */
  divider?: boolean;
  className?: string;
};

/**
 * A quiet invitation row: what is offered, then where it leads. Shared by the quota
 * nudge and the guest's account row so they stay one design.
 */
export function NudgeRow({ icon, message, cta, onPress, testID, divider = true, className }: Props) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={/[.!?…]$/.test(message) ? `${message} ${cta}` : `${message}. ${cta}`}
      testID={testID}
      className={`min-h-[60px] flex-row items-center gap-3 py-4 active:opacity-70 ${divider ? 'border-t border-line' : ''} ${className ?? ''}`}
    >
      <View accessible={false} className="w-10 items-center">
        <IconSymbol name={icon} size={22} color={noctalia.accent.text} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-body leading-[22px] text-ivory">{message}</Text>
        <Text className="font-sans-medium text-body-sm leading-[18px] text-champagne-on">{cta}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
    </Pressable>
  );
}
