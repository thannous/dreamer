import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

/** Keep in step with the `w-[264px]` class on the sidebar root. */
const SIDEBAR_WIDTH = 264;

/**
 * The sidebar is the night of the onboarding carried into the app: it keeps the
 * same reverie artwork and the dark palette in every theme, so the cream reading
 * surface sits beside a familiar sky instead of replacing it. Fixed colours come
 * from the canonical dark palette, like the illustration tokens.
 */
const NIGHT = getNoctaliaPalette('dark');
const BACKGROUND_IMAGE = require('@/assets/images/onboarding-reverie-background.webp');
// The artwork's moon and hillside sit in its upper third. Anchoring a larger
// copy to the bottom edge places that scene under the footer, while the
// navigation stays on plain night ground.
const ARTWORK_STYLE = { position: 'absolute', left: -112, bottom: -420, width: 440, height: 880 } as const;
const NIGHT_SCRIM = [NIGHT.background, NIGHT.background, 'rgba(3, 4, 13, 0.2)', 'rgba(3, 4, 13, 0.35)', 'rgba(3, 4, 13, 0.9)'] as const;
const NIGHT_SCRIM_LOCATIONS = [0, 0.46, 0.68, 0.84, 1] as const;

/** Sidebar paths of the tab pages, mapped to their routes inside `(tabs)`. */
const TAB_ROUTES: Record<string, Href> = {
  '/': '/(tabs)',
  '/journal': '/(tabs)/journal',
  '/statistics': '/(tabs)/statistics',
  '/explore': '/(tabs)/explore',
};

/**
 * Sidebar destinations are peers, so moving between them must not grow the
 * stack. From a tab page, switch tabs or push the root screen. From a root
 * screen such as Capture or Settings, dismiss back to the destination the way
 * the mobile bottom navigation does; an unknown root route replaces the screen.
 */
function useSidebarNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  return (href: Href) => {
    const path = String(href);
    const onTabPage = pathname in TAB_ROUTES;
    const tabRoute = TAB_ROUTES[path];
    if (tabRoute) {
      if (onTabPage) router.navigate(tabRoute);
      else router.dismissTo(tabRoute);
    } else if (onTabPage) {
      router.push(href);
    } else {
      router.dismissTo(href);
    }
  };
}

interface NavItemProps {
  icon: IconName;
  label: string;
  href: Href;
  isActive: boolean;
  testID?: string;
}

function NavItem({ icon, label, href, isActive, testID }: NavItemProps) {
  const navigate = useSidebarNavigation();
  // Uniwind exposes `active:`/`focus:`/`disabled:` on Pressable but no hover variant,
  // and this sidebar is desktop-web only — hover stays a React state.
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={isActive ? undefined : () => navigate(href)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      className="flex-row items-center gap-[14px] rounded-[12px] py-3 pl-[14px] pr-3"
      style={isActive ? styles.itemActive : isHovered ? styles.itemHover : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      aria-current={isActive ? 'page' : undefined}
    >
      <View className="absolute bottom-[10px] left-0 top-[10px] w-[3px] rounded-full" style={isActive ? styles.indicator : undefined} />
      <IconSymbol name={icon} size={21} color={isActive ? NIGHT.accent : NIGHT.muted} />
      <Text
        className={`min-w-0 flex-1 text-[15px] ${isActive ? 'font-sans-bold' : 'font-sans-medium'}`}
        style={{ color: isActive || isHovered ? NIGHT.title : NIGHT.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CaptureAction({ label, isActive, testID }: { label: string; isActive: boolean; testID: string }) {
  const navigate = useSidebarNavigation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={isActive ? undefined : () => navigate('/recording')}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      className="mb-6 flex-row items-center justify-center gap-[10px] rounded-full px-5 py-[13px]"
      style={[styles.capture, (isHovered || isActive) && styles.captureEmphasis, isActive && styles.captureActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      aria-current={isActive ? 'page' : undefined}
    >
      <IconSymbol name="pencil" size={18} color={NIGHT.onAccent} />
      <Text className="font-sans-bold text-[15px]" style={{ color: NIGHT.onAccent }}>
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

  const primaryNavItems: { icon: IconName; label: string; href: Href; testID?: string }[] = [
    { icon: 'house.fill', label: t('nav.home'), href: '/', testID: TID.Tab.Home },
    { icon: 'book.fill', label: t('nav.journal'), href: '/journal', testID: TID.Tab.Journal },
    { icon: 'chart.bar.fill', label: t('nav.stats'), href: '/statistics', testID: TID.Tab.Stats },
    { icon: 'sparkles', label: t('nav.explore'), href: '/explore' as Href, testID: TID.Tab.Explore },
  ];

  const settingsNavItem = {
    icon: 'gear' as IconName,
    label: t('nav.settings'),
    href: '/settings' as Href,
    testID: TID.Tab.Settings,
  };

  const isActive = (href: Href) => {
    const path = typeof href === 'string' ? href : String(href);
    if (path === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(path);
  };

  return (
    <View className="h-full w-[264px] flex-col overflow-hidden" style={styles.root} testID={TID.Component.DesktopSidebar}>
      <Image
        source={BACKGROUND_IMAGE}
        style={ARTWORK_STYLE}
        contentFit="cover"
        accessible={false}
      />
      <LinearGradient
        colors={NIGHT_SCRIM}
        locations={NIGHT_SCRIM_LOCATIONS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View className="flex-1 px-4 pb-5 pt-7">
        <View className="mb-8 px-[10px]">
          <Text className="font-display-semibold text-[26px] leading-[32px]" style={{ color: NIGHT.title }}>
            Noctalia
          </Text>
          <Text className="mt-[2px] font-sans text-[12px] tracking-[1.2px]" style={{ color: NIGHT.muted }}>
            {t('nav.sidebar_tagline')}
          </Text>
        </View>

        {returningGuestBlocked ? null : (
          <CaptureAction
            label={t('nav.capture_dream')}
            isActive={isActive('/recording')}
            testID={TID.Tab.AddDream}
          />
        )}

        <View className="flex-1 gap-1">
          {returningGuestBlocked ? null : primaryNavItems.map((item) => (
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

        <View className="gap-2 pt-3" style={styles.footer}>
          <NavItem
            icon={settingsNavItem.icon}
            label={settingsNavItem.label}
            href={settingsNavItem.href}
            isActive={isActive(settingsNavItem.href)}
            testID={settingsNavItem.testID}
          />
          {appVersion ? (
            <Text className="px-[14px] font-sans text-caption" style={{ color: NIGHT.muted }}>{appVersion}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NIGHT.background },
  itemActive: { backgroundColor: NIGHT.actionTint },
  itemHover: { backgroundColor: NIGHT.surface },
  indicator: { backgroundColor: NIGHT.accent },
  capture: {
    backgroundColor: NIGHT.accent,
    shadowColor: NIGHT.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  captureEmphasis: { shadowOpacity: 0.38, shadowRadius: 24 },
  captureActive: { borderWidth: 1.5, borderColor: NIGHT.title },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: NIGHT.line },
});

export { SIDEBAR_WIDTH };
