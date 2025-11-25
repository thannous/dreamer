import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';

export type SubscriptionCardProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  features: string[];
  loading?: boolean;
  ctaLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  ctaTestID?: string;
};

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  title,
  subtitle,
  badge,
  features,
  loading,
  ctaLabel,
  onPress,
  disabled,
  testID,
  ctaTestID,
}) => {
  const { colors, shadows } = useTheme();

  const showCta = Boolean(ctaLabel && onPress);

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundCard }, shadows.md]} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
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
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
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
            shadows.sm,
            disabled && styles.ctaDisabled,
            pressed && !disabled && styles.ctaPressed,
          ]}
          disabled={disabled}
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
    borderRadius: ThemeLayout.borderRadius.md,
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
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
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
    fontFamily: 'SpaceGrotesk_400Regular',
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
    fontFamily: 'SpaceGrotesk_700Bold',
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
