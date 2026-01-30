import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export type PricingOptionProps = {
  id: string;
  title: string;
  subtitle?: string;
  price: string;
  intervalLabel: string;
  badge?: string;
  state: 'unselected' | 'selected' | 'disabled' | 'selectedDisabled';
  onPress?: (id: string) => void;
  testID?: string;
};

export const PricingOption: React.FC<PricingOptionProps> = ({
  id,
  title,
  subtitle,
  price,
  intervalLabel,
  badge,
  state,
  onPress,
  testID,
}) => {
  const { colors } = useTheme();

  const isDisabled = state === 'disabled' || state === 'selectedDisabled';
  const isSelected = state === 'selected' || state === 'selectedDisabled';

  const handlePress = () => {
    if (isDisabled) return;
    if (onPress) {
      onPress(id);
    }
  };

  const borderColor = isSelected ? colors.accent : colors.divider;
  const backgroundColor = isSelected ? colors.backgroundSecondary : colors.backgroundCard;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          borderColor,
          backgroundColor,
        },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.textOnAccentSurface }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.textPrimary }]}>{price}</Text>
        <Text style={[styles.interval, { color: colors.textSecondary }]}>{intervalLabel}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderWidth: 1,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.sm,
    gap: ThemeLayout.spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.sm,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  badge: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  interval: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});

export default PricingOption;
