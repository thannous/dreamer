import React, { memo, useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
  inputTestID?: string;
}

function SearchIcon({ size = 20, color = '#a097b8' }) {
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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const placeholderText = useMemo(() => placeholder ?? t('journal.search_placeholder'), [placeholder, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} testID={testID}>
      <View style={styles.iconContainer}>
        <SearchIcon size={20} color={colors.textSecondary} />
      </View>
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        testID={inputTestID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholderText}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={placeholderText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.md,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: ThemeLayout.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
