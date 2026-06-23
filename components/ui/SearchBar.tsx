import React, { forwardRef, memo, useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
  inputTestID?: string;
}

type WebTextInputStyle = TextStyle & {
  outlineColor?: string;
  outlineWidth?: number;
};

const webInputFocusResetStyle: WebTextInputStyle | null = Platform.OS === 'web'
  ? {
      outlineColor: 'transparent',
      outlineWidth: 0,
    }
  : null;

export const SearchBar = memo(forwardRef<TextInput, SearchBarProps>(function SearchBar({
  value,
  onChangeText,
  placeholder,
  testID,
  inputTestID,
}: SearchBarProps, forwardedRef) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const setInputRef = useCallback((node: TextInput | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
      return;
    }
    if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  const glassBackground = noctalia.surface.raised;
  const focusBorderColor = noctalia.accent.base;
  const focusBackgroundColor = noctalia.surface.active;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isFocused ? focusBackgroundColor : glassBackground,
          borderWidth: isFocused ? 1.5 : 1,
          borderColor: isFocused ? focusBorderColor : noctalia.surface.border,
        },
      ]}
      testID={testID}
    >
      <IconSymbol
        name="magnifyingglass"
        size={18}
        color={noctalia.text.tertiary}
      />
      <TextInput
        ref={setInputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={noctalia.text.tertiary}
        style={[
          styles.input,
          webInputFocusResetStyle,
          { color: noctalia.text.primary },
        ]}
        testID={inputTestID}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        showSoftInputOnFocus
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
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
            color={noctalia.text.tertiary}
          />
        </Pressable>
      )}
    </View>
  );
}));

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
