import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  useWindowDimensions,
  type TextProps as RNTextProps,
} from 'react-native';

import { TypeScale } from '@/constants/typography';

export type TextVariant =
  | 'display'
  | 'hero'
  | 'saga'
  | 'h1'
  | 'h2'
  | 'chapter'
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
  chapter: 'font-display-light text-h2',
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
  chapter: 'default',
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
  // Give native text one matching pair of unscaled metrics. It applies
  // Dynamic Type to both; mixing CSS fontSize and pre-scaled lineHeight
  // can clip controls or enlarge paragraph spacing a second time.
  const localStyle = StyleSheet.flatten(style);
  const fontSize = localStyle?.fontSize ?? TypeScale[variant].fontSize;
  const lineHeight = localStyle?.lineHeight ??
    Math.max(TypeScale[variant].lineHeight, fontSize * 1.2);

  return (
    <RNText
      // iOS updates glyphs after Dynamic Type changes before measuring the
      // existing line box again. Remount only the text when that scale changes.
      key={fontScale}
      className={`${VARIANT[variant]} ${TONE[resolvedTone]} ${className ?? ''}`}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[style, { fontSize, lineHeight }]}
      {...rest}
    />
  );
}
