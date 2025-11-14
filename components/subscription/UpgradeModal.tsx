import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';

export type UpgradeModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  testIDPrimaryButton?: string;
  testIDSecondaryButton?: string;
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose,
  testIDPrimaryButton,
  testIDSecondaryButton,
}) => {
  const { colors } = useTheme();

  const handlePrimary = () => {
    onPrimary();
  };

  const handleSecondary = () => {
    if (onSecondary) {
      onSecondary();
    } else {
      onClose();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.accent },
              pressed && styles.buttonPressed,
            ]}
            onPress={handlePrimary}
            testID={testIDPrimaryButton}
          >
            <Text style={[styles.primaryText, { color: colors.textOnAccentSurface }]}>{primaryLabel}</Text>
          </Pressable>

          {secondaryLabel ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={handleSecondary}
              testID={testIDSecondaryButton}
            >
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: ThemeLayout.spacing.md,
  },
  title: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.sm,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  secondaryText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});

export default UpgradeModal;
