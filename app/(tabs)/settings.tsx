import React from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import EmailAuthCard from '@/components/auth/EmailAuthCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import { useTheme } from '@/context/ThemeContext';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();

  const isCompactLayout = width <= 375;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <EmailAuthCard isCompact={isCompactLayout} />

        <ThemeSettingsCard />
        <LanguageSettingsCard />
        <NotificationSettingsCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ThemeLayout.spacing.md,
  },
});
