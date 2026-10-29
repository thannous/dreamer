import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale, SPRING } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { TypeScale } from '@/constants/typeScale';

/** Selected state lives in the border and the fill, so both cross over rather than repaint. */
const SELECTION_TRANSITION = ['borderColor', 'backgroundColor'] as const;

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

  // Purpose: state indication. Two plans sit side by side and the only thing separating
  // the chosen one is a border colour — crossing that over, instead of repainting it,
  // is what makes the tap read as "this one" rather than as a redraw. The radio itself
  // springs, because the finger that moved it is still on the screen.
  const reduced = useReducedMotion();
  const selection = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    const target = isSelected ? 1 : 0;
    selection.set(reduced ? target : withSpring(target, SPRING.snapBack));
  }, [isSelected, reduced, selection]);

  const radioStyle = useAnimatedStyle(() => {
    const value = selection.get();
    return { transform: [{ scale: 1 + 0.12 * Math.min(1, Math.max(0, value)) }] };
  });

  return (
    <PressableScale
      style={[
        styles.container,
        compact && styles.compactContainer,
        {
          borderColor,
          backgroundColor,
        },
        style,
        isDisabled && styles.disabled,
      ]}
      transitionProperties={SELECTION_TRANSITION}
      onPress={handlePress}
      disabled={isDisabled}
      // The cards sit 8pt apart in a two-up grid and are far larger than 44pt already,
      // so the default slop would make the gap between them ambiguous.
      hitSlop={0}
      // A radio ticking to a new value is the textbook selection haptic. It fires on
      // press-in alongside the scale, never on its own.
      haptic={isDisabled ? 'none' : 'selection'}
      testID={testID}
      accessibilityRole="radio"
      aria-checked={isSelected}
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
    >
      <View style={[styles.headerRow, compact && styles.compactHeaderRow]}>
        {compact ? (
          <Animated.View style={radioStyle}>
            <IconSymbol
              name={isSelected ? 'largecircle.fill.circle' : 'circle'}
              size={21}
              color={isSelected ? noctalia.accent.text : noctalia.text.tertiary}
            />
          </Animated.View>
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
        <Text
          style={[styles.price, compact && styles.compactPrice, { color: noctalia.text.primary }]}
          testID={testID ? `${testID}.price` : undefined}
        >
          {price}
        </Text>
        <Text style={[styles.interval, { color: noctalia.text.secondary }]}>{intervalLabel}</Text>
      </View>

      {billingDetail ? (
        <Text
          // A trial line names its renewal price and period; two lines keep it whole.
          numberOfLines={2}
          style={[styles.billingDetail, { color: noctalia.text.secondary }]}
          testID={testID ? `${testID}.detail` : undefined}
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
    </PressableScale>
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
    marginBottom: 0,
    padding: 12,
    gap: 8,
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
    fontSize: TypeScale.body.fontSize,
    fontFamily: Fonts.outfit.bold,
  },
  compactTitle: {
    fontSize: TypeScale.body.fontSize,
  },
  subtitle: {
    marginTop: 2,
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
  },
  badge: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: TypeScale.caption.fontSize,
    fontFamily: Fonts.outfit.medium,
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
    fontSize: TypeScale.h2.fontSize,
    fontFamily: Fonts.outfit.bold,
  },
  compactPrice: {
    fontSize: TypeScale.h3.fontSize,
  },
  interval: {
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
  },
  billingDetail: {
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 16,
    fontFamily: Fonts.outfit.regular,
  },
});

export default PricingOption;
