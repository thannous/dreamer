import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
// expo-router ships its own copy of the drawer navigator; its props type is
// the one the `drawerContent` callback is actually given.
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onNavigate(href)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className="flex-row items-center gap-4 rounded-xl px-3 py-3">
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
export function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { mode, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (href: string) => {
    navigation.closeDrawer();
    router.push(href as never);
  };

  return (
    <BlurView
      intensity={mode === 'dark' ? 40 : 48}
      tint={mode === 'dark' ? 'dark' : 'light'}
      style={{
        flex: 1,
        backgroundColor: colors.navbarBg,
        borderRightColor: colors.navbarBorder,
        borderRightWidth: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 16,
      }}>
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
    </BlurView>
  );
}
