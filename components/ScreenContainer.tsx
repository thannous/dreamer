import React, { type ReactNode } from 'react';
import { Platform, View, type ViewProps, useWindowDimensions } from 'react-native';

import { DESKTOP_BREAKPOINT, LAYOUT_MAX_WIDTH, TABLET_BREAKPOINT } from '@/constants/layout';

export type ScreenContainerProps = ViewProps & {
  children: ReactNode;
  maxWidth?: number;
  desktopPaddingHorizontal?: number;
  className?: string;
};

export function ScreenContainer({
  children,
  style,
  className,
  maxWidth = LAYOUT_MAX_WIDTH,
  desktopPaddingHorizontal = 32,
  ...rest
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const isWideConstrainedLayout =
    (Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT)
    || (Platform.OS === 'android' && width >= TABLET_BREAKPOINT);

  if (!isWideConstrainedLayout) {
    return (
      <View className={className} style={style} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View className={className} style={style} {...rest}>
      {/* `maxWidth` and the desktop gutter are props, so they stay values rather than
          classes — a caller can pass any number. */}
      <View className="w-full self-center" style={{ maxWidth, paddingHorizontal: desktopPaddingHorizontal }}>
        {children}
      </View>
    </View>
  );
}
