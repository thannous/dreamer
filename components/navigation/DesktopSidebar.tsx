import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

interface NavItemProps {
  icon: IconName;
  label: string;
  href: Href;
  isActive: boolean;
  testID?: string;
}

/** Keep in step with the `w-[240px]` class on the sidebar root. */
const SIDEBAR_WIDTH = 240;

/** Logo box. `expo-image` is not a Uniwind-patched component, so it keeps a style prop. */
const LOGO_STYLE = { width: 40, height: 40, borderRadius: 10 } as const;

function NavItem({ icon, label, href, isActive, testID }: NavItemProps) {
  const { colors, mode } = useTheme();
  const router = useRouter();
  // Uniwind exposes `active:`/`focus:`/`disabled:` on Pressable but no hover variant,
  // and this sidebar is desktop-web only — hover stays a React state.
  const [isHovered, setIsHovered] = useState(false);
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(href)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      className={`flex-row items-center gap-[14px] rounded-[10px] p-3 ${
        isActive ? 'bg-ink-active' : isHovered ? 'bg-ink-soft' : ''
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconSymbol
        name={icon}
        size={22}
        color={isActive ? noctalia.accent.text : noctalia.text.secondary}
      />
      <Text
        className={`font-sans-medium text-[15px] ${isActive ? 'text-ivory' : 'text-ivory-muted'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DesktopSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { returningGuestBlocked } = useAuth();
  const appVersion = getAppVersionString({ prefix: 'v' });

  // When returning guest is blocked, only show settings
  const allNavItems: { icon: IconName; label: string; href: Href; testID?: string }[] = [
    { icon: 'house.fill', label: t('nav.home'), href: '/', testID: TID.Tab.Home },
    { icon: 'book.fill', label: t('nav.journal'), href: '/journal', testID: TID.Tab.Journal },
    {
      icon: 'pencil',
      label: t('nav.capture_dream'),
      href: '/recording',
      testID: TID.Tab.AddDream,
    },
    { icon: 'chart.bar.fill', label: t('nav.stats'), href: '/statistics', testID: TID.Tab.Stats },
    { icon: 'gear', label: t('nav.settings'), href: '/settings', testID: TID.Tab.Settings },
  ];

  const navItems = returningGuestBlocked
    ? allNavItems.filter((item) => item.href === '/settings')
    : allNavItems;

  const isActive = (href: Href) => {
    const path = typeof href === 'string' ? href : String(href);
    if (path === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(path);
  };

  return (
    <View className="h-full w-[240px] flex-col border-r border-line bg-ink px-4 py-6">
      {/* Logo Section */}
      <View className="mb-8 flex-row items-center gap-3 px-2">
        <Image
          source={require('@/assets/images/icon.png')}
          style={LOGO_STYLE}
          contentFit="contain"
        />
        <Text className="font-sans-bold text-h2 text-ivory">Noctalia</Text>
      </View>

      {/* Navigation Items */}
      <View className="flex-1 gap-1">
        {navItems.map((item) => (
          <NavItem
            key={item.testID ?? item.label}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={isActive(item.href)}
            testID={item.testID}
          />
        ))}
      </View>

      {/* Footer Section */}
      <View className="border-t border-line pt-4">
        {appVersion ? (
          <Text className="font-sans text-caption text-center text-ivory-muted">{appVersion}</Text>
        ) : null}
      </View>
    </View>
  );
}

export { SIDEBAR_WIDTH };
