import React, { useCallback, useMemo } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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
  billingDetail?: string;
  badge?: string;
  state: 'unselected' | 'selected' | 'disabled' | 'selectedDisabled';
  onPress?: (id: string) => void;
  testID?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const PricingOption: React.FC<PricingOptionProps> = function PricingOption({
  id,
  title,
  subtitle,
  price,
  intervalLabel,
  billingDetail,
  badge,
  state,
  onPress,
  testID,
  compact = false,
  style,
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
        compact && styles.compactContainer,
        {
          borderColor,
          backgroundColor,
        },
        style,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="radio"
      aria-checked={isSelected}
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
    >
      <View style={[styles.headerRow, compact && styles.compactHeaderRow]}>
        {compact ? (
          <MaterialIcons
            name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
            size={21}
            color={isSelected ? noctalia.accent.base : noctalia.text.tertiary}
          />
        ) : null}
        <View style={styles.textContainer}>
          <Text style={[styles.title, compact && styles.compactTitle, { color: noctalia.text.primary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {badge && !compact ? (
          <View style={[styles.badge, { backgroundColor: noctalia.action.primary }]}>
            <Text style={[styles.badgeText, { color: noctalia.action.primaryText }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.priceRow, compact && styles.compactPriceRow]}>
        <Text style={[styles.price, compact && styles.compactPrice, { color: noctalia.text.primary }]}>
          {price}
        </Text>
        <Text style={[styles.interval, { color: noctalia.text.secondary }]}>{intervalLabel}</Text>
      </View>

      {billingDetail ? (
        <Text
          numberOfLines={1}
          style={[styles.billingDetail, { color: noctalia.text.secondary }]}
        >
          {billingDetail}
        </Text>
      ) : null}

      {badge && compact ? (
        <View
          style={[
            styles.badge,
            styles.compactBadge,
            {
              backgroundColor: noctalia.action.primary,
              borderColor: noctalia.accent.base,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: noctalia.action.primaryText }]}>{badge}</Text>
        </View>
      ) : null}
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
  compactContainer: {
    minHeight: 126,
    marginBottom: 0,
    padding: 12,
    gap: 8,
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
  compactHeaderRow: {
    justifyContent: 'flex-start',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  compactTitle: {
    fontSize: 15,
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
  compactBadge: {
    position: 'absolute',
    top: -11,
    right: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  compactPriceRow: {
    flexWrap: 'wrap',
    rowGap: 1,
  },
  price: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  compactPrice: {
    fontSize: 18,
  },
  interval: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  billingDetail: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});

export default PricingOption;
