import React, { forwardRef, memo, useCallback, useRef, useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

interface SearchBarProps {
  autoFocus?: boolean;
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

/**
 * Values `className` cannot reach: `borderCurve` is a React Native-only property and the
 * web outline reset is a DOM concern. Both stay as style objects.
 */
const CONTINUOUS_CORNERS = { borderCurve: 'continuous' } as const;

const webInputFocusResetStyle: WebTextInputStyle | null = Platform.OS === 'web'
  ? {
      outlineColor: 'transparent',
      outlineWidth: 0,
    }
  : null;

export const SearchBar = memo(forwardRef<TextInput, SearchBarProps>(function SearchBar({
  autoFocus = false,
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

  return (
    <View
      className={`h-11 flex-row items-center gap-2 rounded-md px-4 ${
        isFocused
          ? 'border-[1.5px] border-champagne bg-ink-active'
          : 'border border-line bg-ink-raised'
      }`}
      style={CONTINUOUS_CORNERS}
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
        className="flex-1 py-0 font-sans text-[15px] text-ivory"
        style={webInputFocusResetStyle}
        testID={inputTestID}
        accessibilityLabel={placeholder}
        autoFocus={autoFocus}
        returnKeyType="search"
        showSoftInputOnFocus
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <PressableScale
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
        </PressableScale>
      )}
    </View>
  );
}));
