/**
 * Native glyph and line-box metrics used together by the shared Text primitive.
 * Keep them aligned with the type tokens in global.css; families and colours
 * remain Uniwind classes. Routes use Text variants rather than local sizes.
 */
export const TypeScale = {
  display: { fontSize: 34, lineHeight: 40 },
  hero: { fontSize: 40, lineHeight: 46 },
  saga: { fontSize: 52, lineHeight: 56 },
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 28 },
  chapter: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  cta: { fontSize: 20, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  step: { fontSize: 12, lineHeight: 16 },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.3 },
  quote: { fontSize: 18, lineHeight: 24 },
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
