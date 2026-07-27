import { Platform } from 'react-native';

export const LAYOUT_MAX_WIDTH = 1200;
export const TAB_BAR_MAX_WIDTH = 960;
export const TABLET_BREAKPOINT = 600;
export const DESKTOP_BREAKPOINT = 1024;
export const TAB_BAR_HEIGHT = 86;
export const COMPACT_TAB_BAR_HEIGHT = 64;
export const COMPACT_TAB_BAR_BOTTOM_INSET = 8;
export const TAB_BAR_MARGIN_ANDROID = 6;
export const TAB_BAR_MARGIN_IOS = 12;
export const TAB_BAR_MARGIN = Platform.OS === 'android' ? TAB_BAR_MARGIN_ANDROID : TAB_BAR_MARGIN_IOS;
export const TAB_BAR_CONTENT_BOTTOM_PADDING = 12;

export function getBottomNavigationLayout(width: number, height: number) {
  const compact = width > height && height < 600;
  return {
    compact,
    barHeight: compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT,
    minimumBottomInset: compact ? COMPACT_TAB_BAR_BOTTOM_INSET : 14,
  };
}

export const TAB_BAR_HORIZONTAL_MARGIN = 22;

export const getTabBarHorizontalLayout = (viewportWidth: number) => {
  const availableWidth = Math.max(0, viewportWidth - TAB_BAR_HORIZONTAL_MARGIN * 2);
  const width = Math.min(availableWidth, TAB_BAR_MAX_WIDTH);

  return {
    left: Math.max(0, (viewportWidth - width) / 2),
    width,
  };
};
