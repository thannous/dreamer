import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  useWindowDimensions,
} from 'react-native';

export type TextVariant =
  | 'display'
  | 'hero'
  | 'saga'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'cta'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'step'
  | 'overline'
  | 'quote';

export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'onAccent' | 'inherit';

/**
 * Fraunces carries the voice (titles, numbers, breath phases), Space Grotesk
 * the interface, Lora the quiet editorial moments.
 *
 * Variants set family and size ONLY. Colour is a separate `tone` prop, because
 * two competing `text-*` classes are resolved by stylesheet order, not by the
 * order they appear in the className string — an override passed from the call
 * site would silently lose.
 */
const VARIANT: Record<TextVariant, string> = {
  display: 'font-display text-display',
  hero: 'font-display-light text-hero',
  saga: 'font-display-light text-saga',
  h1: 'font-display text-h1',
  h2: 'font-display text-h2',
  h3: 'font-medium text-h3',
  cta: 'font-medium text-cta',
  body: 'font-sans text-body',
  bodySm: 'font-sans text-body-sm',
  /** A chosen item in a list of names: interface size, medium weight. */
  label: 'font-medium text-body-sm',
  caption: 'font-sans text-caption',
  /** The name under a step circle, in the voice of the titles. */
  step: 'font-display-light text-caption',
  overline: 'font-medium text-overline uppercase',
  quote: 'font-serif-italic text-h3',
};

/**
 * React Native scales `fontSize`, but an explicit CSS line-height remains in
 * layout points. Without scaling both together, Dynamic Type enlarges the
 * glyphs inside their old line box and crops almost every label. Keep these in
 * step with the matching tokens in `global.css`.
 */
const LINE_HEIGHT: Record<TextVariant, number> = {
  display: 40,
  hero: 46,
  saga: 56,
  h1: 34,
  h2: 28,
  h3: 24,
  cta: 28,
  body: 24,
  bodySm: 20,
  label: 20,
  caption: 16,
  step: 16,
  overline: 14,
  quote: 24,
};

const TONE: Record<TextTone, string> = {
  default: 'text-ivory',
  muted: 'text-ivory-muted',
  faint: 'text-ivory-faint',
  /** Readable champagne — never the `champagne` fill colour. */
  accent: 'text-champagne-text',
  /** For copy sitting on a champagne fill. */
  onAccent: 'text-champagne-on',
  inherit: '',
};

const DEFAULT_TONE: Record<TextVariant, TextTone> = {
  display: 'default',
  hero: 'default',
  saga: 'default',
  h1: 'default',
  h2: 'default',
  h3: 'default',
  cta: 'default',
  body: 'default',
  bodySm: 'muted',
  label: 'default',
  caption: 'faint',
  step: 'muted',
  overline: 'accent',
  quote: 'muted',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

export function Text({
  variant = 'body',
  tone,
  className,
  style,
  maxFontSizeMultiplier = 2,
  ...rest
}: TextProps) {
  const { fontScale } = useWindowDimensions();
  const resolvedTone = tone ?? DEFAULT_TONE[variant];
  const effectiveScale =
    maxFontSizeMultiplier == null ? fontScale : Math.min(fontScale, maxFontSizeMultiplier);
  // A caller that enlarges the font sets its own line box; the variant's would crop it.
  const baseLineHeight = StyleSheet.flatten(style)?.lineHeight ?? LINE_HEIGHT[variant];

  return (
    <RNText
      className={`${VARIANT[variant]} ${TONE[resolvedTone]} ${className ?? ''}`}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[style, { lineHeight: baseLineHeight * effectiveScale }]}
      {...rest}
    />
  );
}
