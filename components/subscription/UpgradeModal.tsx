import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { BottomSheetActions } from '@/components/ui/BottomSheetActions';
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

        <BottomSheetActions
          primaryLabel={primaryLabel}
          onPrimary={handlePrimary}
          primaryTestID={testIDPrimaryButton}
          secondaryLabel={secondaryLabel}
          onSecondary={handleSecondary}
          secondaryTestID={testIDSecondaryButton}
        />
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
});

export default UpgradeModal;
