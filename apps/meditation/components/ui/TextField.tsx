import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  /** Keeps the label for screen readers but not on screen — for a field whose
   *  purpose the surrounding heading already states. */
  hideLabel?: boolean;
  className?: string;
};

export function TextField({ label, hideLabel = false, className, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {hideLabel ? null : <Text variant="overline">{label}</Text>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        // The caret and selection are the one place the champagne fill is
        // allowed near text — it is a mark, not a glyph.
        selectionColor={colors.accent}
        className="h-12 rounded-md border border-hairline bg-ink-card px-4 font-sans text-body text-ivory"
        {...rest}
      />
    </View>
  );
}
