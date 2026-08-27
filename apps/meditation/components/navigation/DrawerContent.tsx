import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
// expo-router ships its own copy of the drawer navigator; its props type is
// the one the `drawerContent` callback is actually given.
import { getDrawerStatusFromState, type DrawerContentComponentProps } from 'expo-router/drawer';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScopedTheme } from 'uniwind';

import { IconSymbol, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useChromeTheme } from '@/hooks/useChromeTheme';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const LINK_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

/**
 * What the panel leads to. Everything here already exists in the root stack —
 * the drawer is a shortcut from any tab, not a second home for these screens.
 */
const LINKS = [
  { href: '/favorites', icon: 'bookmark.fill', label: 'favorites.title' },
  { href: '/settings', icon: 'gear', label: 'settings.title' },
  { href: '/settings/help', icon: 'questionmark.circle', label: 'settings.help' },
  { href: '/settings/legal', icon: 'lock.shield', label: 'settings.legal' },
] as const;

function DrawerLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: string;
  label: string;
  onNavigate: (href: string) => void;
}) {
  const { colors } = useChromeTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={LINK_HIT_SLOP}
      onPress={() => onNavigate(href)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.link, style]}
      className="flex-row items-center gap-4 rounded-xl px-3">
      <IconSymbol name={icon as never} size={20} color={colors.accentText} />
      <Text variant="body">{label}</Text>
    </AnimatedPressable>
  );
}

/**
 * The panel itself: one frosted surface over the app.
 *
 * It is the second and last real blur in the app, and it qualifies for the same
 * reason the tab pill does — a single surface that never scrolls, sitting over
 * content it needs to obscure.
 */
export function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { mode, colors } = useChromeTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOpen = getDrawerStatusFromState(state) === 'open';

  const go = (href: string) => {
    navigation.closeDrawer();
    router.push(href as never);
  };

  return (
    <BlurView
      intensity={mode === 'dark' ? 40 : 48}
      tint={mode === 'dark' ? 'dark' : 'light'}
      accessibilityViewIsModal={isOpen}
      importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
      style={{
        flex: 1,
        backgroundColor: colors.navbarBg,
        borderRightColor: colors.navbarBorder,
        borderRightWidth: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 16,
      }}>
      <ScopedTheme theme={mode}>
        <View className="flex-1">
          <View className="gap-2 px-5 pb-6">
            <Text variant="overline">{t('welcome.tagline')}</Text>
            <Rule className="self-start" />
          </View>

          <View className="gap-1 px-2">
            {LINKS.map((link) => (
              <DrawerLink
                key={link.href}
                href={link.href}
                icon={link.icon}
                label={t(link.label as TranslationKey)}
                onNavigate={go}
              />
            ))}
          </View>
        </View>
      </ScopedTheme>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
});
