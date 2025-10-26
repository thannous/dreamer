import React, { memo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { JournalTheme } from '@/constants/journalTheme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
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

export const SearchBar = memo(function SearchBar({ value, onChangeText, placeholder = 'Search your dream journey...' }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <SearchIcon size={20} color={JournalTheme.textSecondary} />
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={JournalTheme.textSecondary}
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
    backgroundColor: JournalTheme.backgroundSecondary,
    borderRadius: JournalTheme.borderRadius.md,
    paddingHorizontal: JournalTheme.spacing.md,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: JournalTheme.spacing.sm,
  },
  input: {
    flex: 1,
    color: JournalTheme.textPrimary,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
