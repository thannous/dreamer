import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const DANGER_COLOR = '#EF4444';

export type BottomSheetActionsProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestID?: string;
  primaryVariant?: 'accent' | 'danger';

  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  secondaryTestID?: string;

  linkLabel?: string;
  onLink?: () => void;
  linkTestID?: string;
};

export function BottomSheetActions({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryTestID,
  primaryVariant = 'accent',

  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  secondaryTestID,

  linkLabel,
  onLink,
  linkTestID,
}: BottomSheetActionsProps) {
  const { colors } = useTheme();

  const primaryBackgroundColor = primaryVariant === 'danger' ? DANGER_COLOR : colors.accent;
  const primaryTextColor = primaryVariant === 'danger' ? '#FFFFFF' : colors.textOnAccentSurface;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: primaryBackgroundColor },
          (primaryDisabled || primaryLoading) && styles.disabledButton,
          pressed && !primaryDisabled && !primaryLoading && styles.pressedButton,
        ]}
        onPress={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        testID={primaryTestID}
      >
        {primaryLoading ? (
          <ActivityIndicator color={primaryTextColor} size="small" />
        ) : (
          <Text style={[styles.primaryButtonText, { color: primaryTextColor }]}>
            {primaryLabel}
          </Text>
        )}
      </Pressable>

      {secondaryLabel && onSecondary ? (
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: colors.divider,
              backgroundColor: colors.backgroundSecondary,
            },
            secondaryDisabled && styles.disabledButton,
            pressed && !secondaryDisabled && styles.pressedButton,
          ]}
          onPress={onSecondary}
          disabled={secondaryDisabled}
          testID={secondaryTestID}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}

      {linkLabel && onLink ? (
        <Pressable
          style={({ pressed }) => [
            styles.linkButton,
            pressed && styles.pressedButton,
          ]}
          onPress={onLink}
          testID={linkTestID}
        >
          <Text style={[styles.linkButtonText, { color: colors.textSecondary }]}>
            {linkLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  linkButton: {
    paddingVertical: ThemeLayout.spacing.xs,
    alignItems: 'center',
  },
  linkButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    opacity: 0.8,
  },
});

export default BottomSheetActions;
