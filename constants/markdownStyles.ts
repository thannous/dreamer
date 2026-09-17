import type { TextStyle } from 'react-native';
import type { MarkdownStyle } from 'react-native-enriched-markdown';
import { Fonts } from './theme';
import type { ThemeColors } from './journalTheme';

export function createMarkdownStyles(colors: ThemeColors, style: TextStyle = {}, variant: 'body' | 'reading' = 'body'): MarkdownStyle {
  const fontSize = style.fontSize ?? 16;
  const color = typeof style.color === 'string' ? style.color : colors.textPrimary;
  const base = { fontSize, color, fontFamily: style.fontFamily ?? Fonts.spaceGrotesk.regular, lineHeight: style.lineHeight ?? fontSize * 1.5, fontWeight: style.fontWeight == null ? undefined : String(style.fontWeight) };
  const heading = (scale: number) => ({ ...base, fontFamily: variant === 'reading' ? Fonts.lora.bold : Fonts.spaceGrotesk.bold, fontWeight: '700', fontSize: fontSize * scale, lineHeight: fontSize * scale * 1.35, marginTop: fontSize, marginBottom: 8 });
  return {
    paragraph: { ...base, textAlign: style.textAlign, marginTop: 0, marginBottom: variant === 'reading' ? 20 : 10 },
    h1: heading(1.5), h2: heading(1.3), h3: heading(1.15), h4: heading(1.05), h5: heading(1), h6: heading(1),
    strong: { color, fontFamily: Fonts.spaceGrotesk.bold, fontWeight: 'normal' },
    em: { color, fontFamily: Fonts.lora.regularItalic, fontStyle: 'normal' },
    link: { color: colors.accentText, underline: true },
    list: { ...base, marginTop: 4, marginBottom: 12, marginLeft: 24, markerMinWidth: 8, bulletSize: 4, gapWidth: 12, itemSpacing: 6, bulletColor: color, markerColor: color },
    blockquote: { ...base, fontFamily: Fonts.lora.regularItalic, backgroundColor: colors.backgroundSecondary, borderColor: colors.accent, borderWidth: 2, gapWidth: 12, padding: 10, marginTop: 8, marginBottom: 12 },
    code: { fontFamily: Fonts.mono, fontSize: fontSize - 1, color, backgroundColor: colors.backgroundSecondary },
    codeBlock: { ...base, fontFamily: Fonts.mono, fontSize: fontSize - 2, backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 12 },
    thematicBreak: { color: colors.divider, height: 1, marginTop: 12, marginBottom: 12 },
    table: { ...base, fontSize: Math.max(14, fontSize - 1), headerFontFamily: Fonts.spaceGrotesk.bold, headerTextColor: color, headerBackgroundColor: colors.backgroundSecondary, rowEvenBackgroundColor: colors.backgroundCard, rowOddBackgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderWidth: 1, cellPaddingHorizontal: 10, cellPaddingVertical: 8 },
  };
}
