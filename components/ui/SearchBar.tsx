import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
  inputTestID?: string;
}

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder,
  testID,
  inputTestID,
}: SearchBarProps) {
  const { colors, mode } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const glassBackground =
    mode === 'dark' ? 'rgba(35, 26, 63, 0.4)' : `${colors.backgroundCard}A6`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: glassBackground,
          borderWidth: 1,
          borderColor: colors.divider,
        },
      ]}
      testID={testID}
    >
      <IconSymbol
        name="magnifyingglass"
        size={18}
        color={colors.textTertiary}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.textPrimary }]}
        testID={inputTestID}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <IconSymbol
            name="xmark.circle.fill"
            size={18}
            color={colors.textTertiary}
          />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    paddingHorizontal: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
    height: 44,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    paddingVertical: 0,
  },
});
