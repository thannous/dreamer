import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewProps, useWindowDimensions } from 'react-native';

import { DESKTOP_BREAKPOINT, LAYOUT_MAX_WIDTH, TABLET_BREAKPOINT } from '@/constants/layout';

export type ScreenContainerProps = ViewProps & {
  children: ReactNode;
  maxWidth?: number;
  desktopPaddingHorizontal?: number;
};

export function ScreenContainer({
  children,
  style,
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
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View style={style} {...rest}>
      <View
        style={[
          styles.desktopInner,
          {
            maxWidth,
            paddingHorizontal: desktopPaddingHorizontal,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopInner: {
    width: '100%',
    alignSelf: 'center',
  },
});
