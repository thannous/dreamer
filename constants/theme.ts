/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = {
  // Space Grotesk - for display/body text
  spaceGrotesk: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    bold: 'SpaceGrotesk_700Bold',
  },
  // Lora - for serif/quotes
  lora: {
    regular: 'Lora_400Regular',
    regularItalic: 'Lora_400Regular_Italic',
    bold: 'Lora_700Bold',
    boldItalic: 'Lora_700Bold_Italic',
  },
  // Platform fallbacks
  ...Platform.select({
    ios: {
      system: 'system-ui',
      mono: 'ui-monospace',
    },
    default: {
      system: 'normal',
      mono: 'monospace',
    },
    web: {
      system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
  }),
};

export const SurrealTheme = {
  bgStart: '#1a0f2b',
  bgEnd: '#3b2a50',
  textLight: '#e0d9f0',
  textMuted: '#a097b8',
  accent: '#6b5a8e',
  shape: '#4f3d6b',
  darkAccent: '#2e1d47',
};
