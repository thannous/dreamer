import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'caption'
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
  h1: 'font-display text-h1',
  h2: 'font-display text-h2',
  h3: 'font-medium text-h3',
  body: 'font-sans text-body',
  bodySm: 'font-sans text-body-sm',
  caption: 'font-sans text-caption',
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
  h1: 'default',
  h2: 'default',
  h3: 'default',
  body: 'default',
  bodySm: 'muted',
  caption: 'faint',
  overline: 'accent',
  quote: 'muted',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

export function Text({ variant = 'body', tone, className, ...rest }: TextProps) {
  const resolvedTone = tone ?? DEFAULT_TONE[variant];

  return (
    <RNText
      className={`${VARIANT[variant]} ${TONE[resolvedTone]} ${className ?? ''}`}
      {...rest}
    />
  );
}
