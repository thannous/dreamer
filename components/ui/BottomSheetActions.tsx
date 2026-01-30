import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const DANGER_COLOR = '#EF4444';

export type BottomSheetActionState = 'enabled' | 'disabled' | 'loading';

export function BottomSheetActions({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

export type BottomSheetPrimaryActionProps = {
  label: string;
  onPress: () => void;
  state?: BottomSheetActionState;
  testID?: string;
  variant?: 'accent' | 'danger';
};

export function BottomSheetPrimaryAction({
  label,
  onPress,
  state = 'enabled',
  testID,
  variant = 'accent',
}: BottomSheetPrimaryActionProps) {
  const { colors } = useTheme();

  const isDisabled = state !== 'enabled';
  const isLoading = state === 'loading';
  const backgroundColor = variant === 'danger' ? DANGER_COLOR : colors.accent;
  const textColor = variant === 'danger' ? '#FFFFFF' : colors.textOnAccentSurface;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor },
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.primaryButtonText, { color: textColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export type BottomSheetSecondaryActionProps = {
  label: string;
  onPress: () => void;
  state?: Exclude<BottomSheetActionState, 'loading'>;
  testID?: string;
};

export function BottomSheetSecondaryAction({
  label,
  onPress,
  state = 'enabled',
  testID,
}: BottomSheetSecondaryActionProps) {
  const { colors } = useTheme();
  const isDisabled = state === 'disabled';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          borderColor: colors.divider,
          backgroundColor: colors.backgroundSecondary,
        },
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
    >
      <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export type BottomSheetLinkActionProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function BottomSheetLinkAction({ label, onPress, testID }: BottomSheetLinkActionProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.linkButton,
        pressed && styles.pressedButton,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.linkButtonText, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
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
