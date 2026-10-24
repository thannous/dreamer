import { Platform } from 'react-native';

export const Fonts = {
  // Outfit - for display/body text
  outfit: {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    bold: 'Outfit_700Bold',
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
  const opacity = mode === 'dark' ? 0.3 : 0.96;
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
