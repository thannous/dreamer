import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import EmailAuthCard from '@/components/auth/EmailAuthCard';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);

  const isCompactLayout = width <= 375;
  const isDesktopLayout = Platform.OS === 'web' && width >= 1024;

  const handleUpgradeScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
        </View>
      </ScreenContainer>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer>
          <View style={[styles.sectionsContainer, isDesktopLayout && styles.sectionsContainerDesktop]}>
            <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
              <EmailAuthCard isCompact={isCompactLayout} />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <QuotaStatusCard onUpgradePress={handleUpgradeScroll} />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <ThemeSettingsCard />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <LanguageSettingsCard />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <NotificationSettingsCard />
            </View>
          </View>
        </ScreenContainer>
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
  sectionsContainer: {
    flexDirection: 'column',
  },
  sectionsContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -ThemeLayout.spacing.sm,
  },
  sectionItemDesktop: {
    width: '50%',
    minWidth: 320,
    paddingHorizontal: ThemeLayout.spacing.sm,
  },
  sectionSpacing: {
    marginTop: ThemeLayout.spacing.md,
  },
});
