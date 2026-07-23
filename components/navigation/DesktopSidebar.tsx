import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
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
  const { colors, mode } = useTheme();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(href as '/(tabs)')}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.navItem,
        isActive && { backgroundColor: noctalia.surface.active },
        isHovered && !isActive && { backgroundColor: noctalia.surface.soft },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconSymbol
        name={icon}
        size={22}
        color={isActive ? noctalia.accent.base : noctalia.text.secondary}
      />
      <Text
        style={[
          styles.navLabel,
          { color: isActive ? noctalia.text.primary : noctalia.text.secondary },
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
  const { colors, mode } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const appVersion = getAppVersionString({ prefix: 'v' });
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  // When returning guest is blocked, only show settings
  const allNavItems: { icon: IconName; label: string; href: string; testID?: string }[] = [
    { icon: 'house.fill', label: t('nav.home'), href: '/', testID: TID.Tab.Home },
    { icon: 'book.fill', label: t('nav.journal'), href: '/journal', testID: TID.Tab.Journal },
    { icon: 'chart.bar.fill', label: t('nav.stats'), href: '/statistics', testID: TID.Tab.Stats },
    { icon: 'gear', label: t('nav.settings'), href: '/settings', testID: TID.Tab.Settings },
  ];

  const navItems = returningGuestBlocked
    ? allNavItems.filter((item) => item.href === '/settings')
    : allNavItems;

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(href);
  };

  return (
    <View
      style={[
        styles.sidebar,
        { backgroundColor: noctalia.screen.background, borderRightColor: noctalia.surface.border },
      ]}
    >
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={[styles.appName, { color: noctalia.text.primary }]}>Noctalia</Text>
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
      <View style={[styles.footer, { borderTopColor: noctalia.surface.border }]}>
        {appVersion ? (
          <Text style={[styles.footerText, { color: noctalia.text.secondary }]}>{appVersion}</Text>
        ) : null}
      </View>
    </View>
  );
}

export { SIDEBAR_WIDTH };

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    borderRightWidth: 1,
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
  navLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    textAlign: 'center',
  },
});
