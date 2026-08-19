import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  /**
   * @deprecated Theme-specific overrides are handled by the `dark:` variant now.
   * Pass `className="bg-x dark:bg-y"` instead.
   */
  lightColor?: string;
  /** @deprecated See `lightColor`. */
  darkColor?: string;
  className?: string;
};

export function ThemedView({ style, lightColor, darkColor, className, ...otherProps }: ThemedViewProps) {
  return <View className={`bg-ink ${className ?? ''}`} style={style} {...otherProps} />;
}
