import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export type SubscriptionCardProps = {
  title: string;
  subtitle?: string;
  expiryLabel?: string;
  badge?: string;
  features: string[];
  status?: 'idle' | 'loading';
  ctaLabel?: string;
  onPress?: () => void;
  ctaState?: 'enabled' | 'disabled';
  testID?: string;
  ctaTestID?: string;
  presentation?: 'card' | 'embedded';
};

export const SubscriptionCard: React.FC<SubscriptionCardProps> = function SubscriptionCard({
  title,
  subtitle,
  expiryLabel,
  badge,
  features,
  status = 'idle',
  ctaLabel,
  onPress,
  ctaState = 'enabled',
  testID,
  ctaTestID,
  presentation = 'card',
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const showCta = Boolean(ctaLabel && onPress);
  const isLoading = status === 'loading';
  const isCtaDisabled = ctaState === 'disabled' || isLoading;

  return (
    <View
      style={[
        styles.card,
        presentation === 'embedded'
          ? styles.embedded
          : {
              backgroundColor: noctalia.surface.raised,
              borderColor: noctalia.surface.border,
            },
      ]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>{subtitle}</Text>
          ) : null}
          {expiryLabel ? (
            <Text style={[styles.expiryLabel, { color: noctalia.text.secondary }]}>{expiryLabel}</Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: noctalia.action.primary }]}>
            <Text style={[styles.badgeText, { color: noctalia.action.primaryText }]}>{badge}</Text>
          </View>
        ) : null}
        {isLoading ? <ActivityIndicator color={noctalia.accent.base} /> : null}
      </View>

      <View style={styles.featureList}>
        {features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={[styles.featureBullet, { color: noctalia.accent.base }]}>•</Text>
          <Text style={[styles.featureText, { color: noctalia.text.primary }]}>{feature}</Text>
        </View>
      ))}
    </View>

      {showCta && (
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: isCtaDisabled ? noctalia.action.disabled : noctalia.action.primary,
              borderColor: isCtaDisabled ? noctalia.action.disabledBorder : noctalia.action.primaryBorder,
            },
            isCtaDisabled && styles.ctaDisabled,
            pressed && !isCtaDisabled && styles.ctaPressed,
          ]}
          disabled={isCtaDisabled}
          onPress={onPress}
          testID={ctaTestID}
        >
          <Text
            style={[
              styles.ctaText,
              { color: isCtaDisabled ? noctalia.action.disabledText : noctalia.action.primaryText },
            ]}
          >
            {ctaLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
    borderWidth: 1,
  },
  embedded: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 0,
    padding: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  expiryLabel: {
    marginTop: 6,
    fontSize: 12,
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
  featureList: {
    marginTop: ThemeLayout.spacing.sm,
    gap: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  featureBullet: {
    marginTop: 2,
    fontSize: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 10,
    borderRadius: ThemeLayout.borderRadius.full,
    marginTop: ThemeLayout.spacing.sm,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaPressed: {
    opacity: 0.8,
  },
});

export default SubscriptionCard;
