import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
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

export const PricingOption: React.FC<PricingOptionProps> = function PricingOption({
  id,
  title,
  subtitle,
  price,
  intervalLabel,
  badge,
  state,
  onPress,
  testID,
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const isDisabled = state === 'disabled' || state === 'selectedDisabled';
  const isSelected = state === 'selected' || state === 'selectedDisabled';

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    if (onPress) {
      onPress(id);
    }
  }, [id, isDisabled, onPress]);

  const borderColor = isSelected ? noctalia.accent.base : noctalia.surface.border;
  const backgroundColor = isSelected ? noctalia.surface.active : noctalia.surface.raised;

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
          <Text style={[styles.title, { color: noctalia.text.primary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: noctalia.action.primary }]}>
            <Text style={[styles.badgeText, { color: noctalia.action.primaryText }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: noctalia.text.primary }]}>{price}</Text>
        <Text style={[styles.interval, { color: noctalia.text.secondary }]}>{intervalLabel}</Text>
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
