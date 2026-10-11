import type { TextInputInstance } from 'react-native';
import React, { forwardRef, memo, useCallback, useMemo, useRef, useState } from 'react';
import { Platform, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';

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

export function sanitizeSearchQuery(text: string) {
  return text.replace(/[\n\r]+/g, ' ');
}

export function searchBarLayout(fontScale: number) {
  const scale = Number.isFinite(fontScale) ? Math.min(1.3, Math.max(1, fontScale)) : 1;
  const inputMinHeight = Math.round(20 * scale);
  const verticalPadding = Math.max(8, Math.round(8 * scale));
  return {
    inputMinHeight,
    verticalPadding,
    minHeight: Math.max(44, inputMinHeight + 2 * verticalPadding),
  };
}

export const SearchBar = memo(forwardRef<TextInputInstance, SearchBarProps>(function SearchBar({
  autoFocus = false,
  value,
  onChangeText,
  placeholder,
  testID,
  inputTestID,
}: SearchBarProps, forwardedRef) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const inputRef = useRef<TextInputInstance>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { fontScale } = useWindowDimensions();
  const { minHeight, inputMinHeight, verticalPadding } = useMemo(
    () => searchBarLayout(fontScale),
    [fontScale],
  );
  const handleChangeText = useCallback((text: string) => {
    onChangeText(sanitizeSearchQuery(text));
  }, [onChangeText]);
  const setInputRef = useCallback((node: TextInputInstance | null) => {
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
      // Always see-through: the page's painting stays visible behind the search, focused or not.
      className={`min-h-11 flex-row items-center gap-2 overflow-visible rounded-md bg-transparent px-4 ${
        isFocused ? 'border-[1.5px] border-champagne' : 'border border-line'
      }`}
      style={[CONTINUOUS_CORNERS, { minHeight, paddingVertical: verticalPadding }]}
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
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={noctalia.text.tertiary}
        className="min-w-0 flex-1 py-0 font-sans text-[15px] leading-5 text-ivory"
        style={[
          webInputFocusResetStyle,
          {
            minHeight: inputMinHeight,
            fontSize: 15 * Math.min(1.3, Math.max(1, fontScale)),
            lineHeight: 20 * Math.min(1.3, Math.max(1, fontScale)),
            paddingVertical: 0,
            includeFontPadding: false,
          },
        ]}
        testID={inputTestID}
        accessibilityLabel={placeholder}
        allowFontScaling={false}
        textAlignVertical="center"
        underlineColorAndroid="transparent"
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
