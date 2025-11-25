import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, SurrealTheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

interface NavItemProps {
  icon: IconName;
  label: string;
  href: string;
  isActive: boolean;
  testID?: string;
}

const SIDEBAR_WIDTH = 240;

function NavItem({ icon, label, href, isActive, testID }: NavItemProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(href as '/(tabs)')}
      style={({ hovered }) => [
        styles.navItem,
        isActive && styles.navItemActive,
        hovered && !isActive && styles.navItemHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconSymbol
        name={icon}
        size={22}
        color={isActive ? colors.textPrimary : SurrealTheme.textMuted}
      />
      <Text
        style={[
          styles.navLabel,
          { color: isActive ? colors.textPrimary : SurrealTheme.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DesktopSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const navItems: { icon: IconName; label: string; href: string; testID?: string }[] = [
    { icon: 'house.fill', label: t('nav.home'), href: '/', testID: TID.Tab.Home },
    { icon: 'book.fill', label: t('nav.journal'), href: '/journal', testID: TID.Tab.Journal },
    { icon: 'chart.bar.fill', label: t('nav.stats'), href: '/statistics', testID: TID.Tab.Stats },
    { icon: 'gear', label: t('nav.settings'), href: '/settings', testID: TID.Tab.Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(href);
  };

  return (
    <View style={styles.sidebar}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.appName}>Noctalia</Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.navSection}>
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={isActive(item.href)}
            testID={item.testID}
          />
        ))}
      </View>

      {/* Footer Section */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0</Text>
      </View>
    </View>
  );
}

export { SIDEBAR_WIDTH };

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: SurrealTheme.bgStart,
    borderRightWidth: 1,
    borderRightColor: SurrealTheme.shape,
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'column',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  appName: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 22,
    color: SurrealTheme.textLight,
    letterSpacing: -0.5,
  },
  navSection: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: SurrealTheme.shape,
  },
  navItemHover: {
    backgroundColor: 'rgba(79, 61, 107, 0.5)',
  },
  navLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SurrealTheme.shape,
  },
  footerText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    color: SurrealTheme.textMuted,
    textAlign: 'center',
  },
});
