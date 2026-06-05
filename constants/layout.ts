import { Platform } from 'react-native';

export const LAYOUT_MAX_WIDTH = 1200;
export const TAB_BAR_MAX_WIDTH = 960;
export const TABLET_BREAKPOINT = 600;
export const DESKTOP_BREAKPOINT = 1024;
export const TAB_BAR_HEIGHT = 86;
export const TAB_BAR_MARGIN_ANDROID = 6;
export const TAB_BAR_MARGIN_IOS = 12;
export const TAB_BAR_MARGIN = Platform.OS === 'android' ? TAB_BAR_MARGIN_ANDROID : TAB_BAR_MARGIN_IOS;
export const TAB_BAR_CONTENT_BOTTOM_PADDING = 12;
