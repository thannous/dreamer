import React from 'react';
import { View } from 'react-native';

import { Text } from './Text';

type Props = React.PropsWithChildren<{
  title?: string;
  className?: string;
}>;

/**
 * Bottom sheet body. Presentation (modal, form sheet, detents) is the router's
 * job — this only draws the surface, the grab handle and the title.
 */
export function Sheet({ title, className, children }: Props) {
  return (
    <View
      className={`rounded-t-[28px] border-t border-hairline bg-ink-card px-gutter pb-8 pt-3 ${className ?? ''}`}>
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-ivory-faint opacity-40" />
      {title ? (
        <Text variant="h2" className="mb-1 text-center">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
