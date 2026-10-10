import React from 'react';
import { View } from 'react-native';

import { Text, type TextProps } from './Text';

/**
 * Noctalia Dreams' section label: a short rule, then the overline. The rule is
 * decorative, so the row reads as its text alone.
 */
export function Eyebrow({ children, className, ...rest }: Omit<TextProps, 'variant'>) {
  return (
    <View className={`flex-row items-center gap-2 ${className ?? ''}`}>
      <View accessible={false} className="h-px w-5 bg-champagne-text" />
      <Text variant="overline" {...rest}>
        {children}
      </Text>
    </View>
  );
}
