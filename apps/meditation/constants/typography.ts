/**
 * Type scale. Prefer the Tailwind classes (`text-h1 font-display`) in
 * components; this map exists for the few places that need raw numbers.
 */
export const TypeScale = {
  display: { fontSize: 34, lineHeight: 40 },
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.3 },
} as const;

export const FontFamily = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayLight: 'Fraunces_400Regular',
  sans: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
  serif: 'Lora_400Regular',
  serifItalic: 'Lora_400Regular_Italic',
} as const;
