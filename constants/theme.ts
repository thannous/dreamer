/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reaunistctnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F0EEE6',
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
  // Fraunces - for dreamlike titles/quotes (Noctalia style)
  fraunces: {
    regular: 'Fraunces_400Regular',
    medium: 'Fraunces_500Medium',
    semiBold: 'Fraunces_600SemiBold',
    bold: 'Fraunces_700Bold',
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

/**
 * Returns a semi-transparent version of backgroundCard for glassmorphism effect.
 * Dark mode uses 30% opacity, light mode uses 70% opacity.
 */
export function getGlassCardBackground(backgroundCard: string, mode: 'light' | 'dark'): string {
  const opacity = mode === 'dark' ? 0.3 : 0.7;
  const opacityHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${backgroundCard}${opacityHex}`;
}

export const GLASS_CARD_BORDER_WIDTH = 1;

export const GlassCardTokens = {
  borderWidth: GLASS_CARD_BORDER_WIDTH,
  borderRadius: 24,
  getBackground: getGlassCardBackground,
} as const;

export const SurrealTheme = {
  bgStart: '#1a0f2b',
  bgEnd: '#3b2a50',
  textLight: '#e0d9f0',
  textMuted: '#a097b8',
  accent: '#6b5a8e',
  shape: '#4f3d6b',
  darkAccent: '#2e1d47',
};
