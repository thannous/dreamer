import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts, GlassCardTokens } from '@/constants/theme';
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
};

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
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
}) => {
  const { colors, mode } = useTheme();
  const cardBg = GlassCardTokens.getBackground(colors.backgroundCard, mode);

  const showCta = Boolean(ctaLabel && onPress);
  const isLoading = status === 'loading';
  const isCtaDisabled = ctaState === 'disabled' || isLoading;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GlassCardTokens.borderWidth }]} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {expiryLabel ? (
            <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>{expiryLabel}</Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.textOnAccentSurface }]}>{badge}</Text>
          </View>
        ) : null}
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      <View style={styles.featureList}>
        {features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={[styles.featureBullet, { color: colors.accent }]}>•</Text>
          <Text style={[styles.featureText, { color: colors.textPrimary }]}>{feature}</Text>
        </View>
      ))}
    </View>

      {showCta && (
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: colors.accent },
            isCtaDisabled && styles.ctaDisabled,
            pressed && !isCtaDisabled && styles.ctaPressed,
          ]}
          disabled={isCtaDisabled}
          onPress={onPress}
          testID={ctaTestID}
        >
          <Text style={[styles.ctaText, { color: colors.textOnAccentSurface }]}>{ctaLabel}</Text>
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
  },
  ctaText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.4,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaPressed: {
    opacity: 0.8,
  },
});

export default SubscriptionCard;
