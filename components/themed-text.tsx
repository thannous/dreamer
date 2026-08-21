import { Text, type TextProps } from 'react-native';

export type ThemedTextVariant = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';

export type ThemedTextProps = TextProps & {
  /**
   * @deprecated Theme-specific overrides are handled by the `dark:` variant now.
   * Pass `className="text-x dark:text-y"` instead.
   */
  lightColor?: string;
  /** @deprecated See `lightColor`. */
  darkColor?: string;
  type?: ThemedTextVariant;
  className?: string;
};

/**
 * Variants carry font and size only — never colour. A variant that also set a colour
 * would silently beat the caller's `text-*` class at the call site, which is the exact
 * class of contrast regression ADR-001 set out to remove.
 */
const VARIANT: Record<ThemedTextVariant, string> = {
  default: 'text-body',
  defaultSemiBold: 'text-body font-sans-medium',
  title: 'text-[32px] leading-[32px] font-display-bold',
  subtitle: 'text-[20px] font-display-semibold',
  link: 'text-body leading-[30px]',
};

/** Tone is separate, so a caller's `text-*` class always wins. */
const TONE: Record<ThemedTextVariant, string> = {
  default: 'text-ivory',
  defaultSemiBold: 'text-ivory',
  title: 'text-ivory',
  subtitle: 'text-ivory',
  link: 'text-champagne-on',
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', className, ...rest }: ThemedTextProps) {
  return <Text className={`${VARIANT[type]} ${TONE[type]} ${className ?? ''}`} style={style} {...rest} />;
}
