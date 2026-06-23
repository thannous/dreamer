import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  testID?: string;
};

export const UpsellCard: React.FC<Props> = ({ testID }) => {
  const { user } = useAuth();
  const { dreams } = useDreams();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  if (user) return null;
  // Show after the 1st dream is created (and onwards) for guests
  if (dreams.length < 1) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
      ]}
      testID={testID}
    >
      <Text style={[styles.title, { color: noctalia.text.primary }]}>{t('guest.upsell.title')}</Text>
      <View style={styles.benefits}>
        <Text style={[styles.benefit, { color: noctalia.text.primary }]}>
          • {t('guest.upsell.benefit.unlimited')}
        </Text>
        <Text style={[styles.benefit, { color: noctalia.text.primary }]}>
          • {t('guest.upsell.benefit.analysis')}
        </Text>
      </View>
      <Pressable
        style={[
          styles.cta,
          { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
        ]}
        onPress={() => router.push('/(tabs)/settings')}
      >
        <Text style={[styles.ctaText, { color: noctalia.action.primaryText }]}>
          {t('guest.upsell.cta')}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
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
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
