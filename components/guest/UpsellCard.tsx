import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  testID?: string;
};

export const UpsellCard: React.FC<Props> = ({ testID }) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const { dreams } = useDreams();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  if (user || dismissed) return null;
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
      <Pressable
        style={[
          styles.cta,
          { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.raised },
        ]}
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/settings')}
      >
        <Text style={[styles.ctaText, { color: noctalia.accent.text }]}>
          {t('guest.upsell.compact')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel={t('guest.upsell.dismiss')}
        style={styles.dismiss}
      >
        <Text style={{ color: noctalia.text.secondary, fontSize: 20 }}>×</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cta: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ctaText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
