import React, { type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { LAYOUT_MAX_WIDTH, TABLET_BREAKPOINT } from '@/constants/layout';
import { useContentWindow } from '@/context/ContentWindowContext';

export type ScreenContainerProps = ViewProps & {
  children: ReactNode;
  maxWidth?: number;
  /** Propagate a bounded parent height through the wide-layout wrapper. */
  fillContent?: boolean;
  desktopPaddingHorizontal?: number;
  className?: string;
};

/**
 * True where `ScreenContainer` narrows and pads its content, leaving side gutters: on
 * every platform once the screen is tablet-wide (the open iPhone Duo, a tablet, a phone
 * on its side, a browser window).
 */
export function useWideConstrainedLayout(): boolean {
  const { width } = useContentWindow();
  return width >= TABLET_BREAKPOINT;
}

export function ScreenContainer({
  children,
  style,
  className,
  maxWidth = LAYOUT_MAX_WIDTH,
  fillContent = false,
  desktopPaddingHorizontal = 32,
  ...rest
}: ScreenContainerProps) {
  const isWideConstrainedLayout = useWideConstrainedLayout();

  // One tree at every width: folding or unfolding an iPhone Duo crosses the breakpoint,
  // and a different parent would remount the page under the person's finger.
  return (
    <View className={className} style={style} {...rest}>
      {/* `maxWidth` and the desktop gutter are props, so they stay values rather than
          classes — a caller can pass any number. */}
      <View className="w-full self-center" pointerEvents={rest.pointerEvents === 'box-none' ? 'box-none' : undefined} style={{ ...(isWideConstrainedLayout ? { maxWidth, paddingHorizontal: desktopPaddingHorizontal } : {}), ...(fillContent ? { flex: 1 } : {}) }}>
        {children}
      </View>
    </View>
  );
}
