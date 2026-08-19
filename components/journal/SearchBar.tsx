import React, { memo, useMemo, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
  inputTestID?: string;
}

function SearchIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        fill={color}
      />
    </Svg>
  );
}

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder,
  testID,
  inputTestID,
}: SearchBarProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const placeholderText = useMemo(() => placeholder ?? t('journal.search_placeholder'), [placeholder, t]);
  const inputRef = useRef<TextInput>(null);

  return (
    <View
      className="flex-row items-center rounded-md border border-line bg-ink-soft px-4 py-1.5"
      testID={testID}
    >
      <View className="mr-2">
        <SearchIcon size={20} color={noctalia.text.secondary} />
      </View>
      <TextInput
        ref={inputRef}
        className="flex-1 font-sans text-[16px] text-ivory"
        testID={inputTestID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholderText}
        placeholderTextColor={noctalia.text.secondary}
        accessibilityLabel={placeholderText}
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
          accessibilityLabel={t('common.clear')}
          hitSlop={8}
          className="ml-2 active:opacity-70"
        >
          <IconSymbol name="xmark.circle.fill" size={18} color={noctalia.text.secondary} />
        </Pressable>
      )}
    </View>
  );
});
