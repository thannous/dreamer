import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { IconSymbol } from './icon-symbol';

import { Themes, type ThemeMode } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

import { Text } from './Text';
import { ArtworkGlassPanel } from './ArtworkGlassPanel';

type Props = TextInputProps & {
  label: string;
  /** Keeps the label for screen readers but not on screen — for a field whose
   *  purpose the surrounding heading already states. */
  hideLabel?: boolean;
  /** Leading SF Symbol, e.g. `magnifyingglass` on a search field. */
  icon?: 'magnifyingglass';
  appearance?: ThemeMode;
  className?: string;
};

export function TextField({
  label,
  hideLabel = false,
  icon,
  appearance,
  className,
  ...rest
}: Props) {
  const { colors: appColors } = useTheme();
  const colors = appearance ? Themes[appearance] : appColors;

  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {hideLabel ? null : <Text variant="overline">{label}</Text>}
      <View className="justify-center">
        {icon ? (
          <View className="absolute left-4 z-10">
            <IconSymbol name={icon} color={colors.textTertiary} size={20} />
          </View>
        ) : null}
        {appearance ? (
          <ArtworkGlassPanel appearance={appearance}>
            <TextInput
              accessibilityLabel={label}
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              className={`min-h-12 bg-transparent py-3 font-sans text-body text-ivory ${
                icon ? 'pl-11 pr-4' : 'px-4'
              }`}
              {...rest}
            />
          </ArtworkGlassPanel>
        ) : (
          <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textTertiary}
          // The caret and selection are the one place the champagne fill is
          // allowed near text — it is a mark, not a glyph.
          selectionColor={colors.accent}
          className={`min-h-12 rounded-md border border-hairline bg-ink-card py-3 font-sans text-body text-ivory ${
            icon ? 'pl-11 pr-4' : 'px-4'
          }`}
          {...rest}
          />
        )}
      </View>
    </View>
  );
}
