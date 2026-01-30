import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { Fonts, GlassCardTokens } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  testID?: string;
};

export const UpsellCard: React.FC<Props> = ({ testID }) => {
  const { user } = useAuth();
  const { dreams } = useDreams();
  const { colors, mode } = useTheme();
  const cardBg = GlassCardTokens.getBackground(colors.backgroundCard, mode);
  const { t } = useTranslation();

  if (user) return null;
  // Show after the 1st dream is created (and onwards) for guests
  if (dreams.length < 1) return null;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GlassCardTokens.borderWidth }]} testID={testID}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('guest.upsell.title')}</Text>
      <View style={styles.benefits}>
        <Text style={[styles.benefit, { color: colors.textPrimary }]}>• {t('guest.upsell.benefit.unlimited')}</Text>
        <Text style={[styles.benefit, { color: colors.textPrimary }]}>• {t('guest.upsell.benefit.analysis')}</Text>
      </View>
      <Pressable style={[styles.cta, { backgroundColor: colors.accent }]} onPress={() => router.push('/(tabs)/settings')}>
        <Text style={styles.ctaText}>{t('guest.upsell.cta')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  benefits: {
    marginTop: 4,
    gap: 2,
  },
  benefit: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  cta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
