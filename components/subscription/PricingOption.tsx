import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';

export type PricingOptionProps = {
  id: string;
  title: string;
  subtitle?: string;
  price: string;
  intervalLabel: string;
  badge?: string;
  selected?: boolean;
  disabled?: boolean;
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
  selected,
  disabled,
  onPress,
  testID,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    if (onPress) {
      onPress(id);
    }
  };

  const borderColor = selected ? colors.accent : colors.divider;
  const backgroundColor = selected ? colors.backgroundSecondary : colors.backgroundCard;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          borderColor,
          backgroundColor,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
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
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  badge: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  interval: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});

export default PricingOption;
