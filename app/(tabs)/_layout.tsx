import { Tabs, router, useSegments } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  DESKTOP_BREAKPOINT,
  getBottomNavigationLayout,
  getTabBarHorizontalLayout,
} from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import { useStartupRoute } from '@/context/StartupRouteContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBg: string;
  barBorder: string;
  accent: string;
  accentLight: string;
  textOnAccentSurface: string;
  text: string;
  textActive: string;
};

function TabBarItem({ label, icon, focused, palette, compact, narrow }: {
  label: string;
  icon: IconName;
  focused: boolean;
  palette: TabPalette;
  compact: boolean;
  narrow: boolean;
}) {
  return (
    <View
      className={`flex-1 min-w-0 items-center justify-center ${
        compact ? 'gap-[1px]' : narrow ? 'gap-[4px]' : 'gap-[5px]'
      }`}
    >
      <IconSymbol
        size={24}
        name={icon}
        color={focused ? palette.textActive : palette.text}
      />
      <Text
        className={`w-full min-w-0 shrink text-center font-sans-medium ${
          compact ? 'text-[11px]' : narrow ? 'text-[11px] px-[1px]' : 'text-[12px]'
        }`}
        style={{ color: focused ? palette.textActive : palette.text }}
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={narrow ? 0.75 : 0.8}
        maxFontSizeMultiplier={narrow ? 1.3 : undefined}>
        {label}
      </Text>
    </View>
  );
}

function AddDreamTabItem({ label, palette, compact, narrow }: {
  label: string;
  palette: TabPalette;
  compact: boolean;
  narrow: boolean;
}) {
  // While a dream analysis runs in the background, the Capture button carries
  // the in-progress state so no overlay has to cover the screen content.
  const { activeAnalysis } = useAnalysisActivity();
  return (
    <View
      accessibilityState={activeAnalysis ? { busy: true } : undefined}
      className={`items-center justify-center border-2 ${
        compact
          ? 'w-[60px] h-[56px] rounded-[22px] gap-[1px]'
          : narrow
            ? 'w-[64px] h-[68px] rounded-[24px] gap-[3px]'
            : 'w-[72px] h-[76px] rounded-[27px] gap-[4px]'
      }`}
      style={[
        // The lift stays a real transform: Tailwind v4 emits `translate` through CSS
        // variables and Uniwind resolves that declaration by splitting the string, so
        // `-translate-y-2` is not safe here. Shadows stay too — RN spreads them over
        // shadow*/elevation, which has no single Tailwind equivalent, and the colour
        // is derived from the palette.
        ADD_TAB_LIFT[compact ? 'compact' : narrow ? 'narrow' : 'default'],
        ADD_TAB_SHADOW,
        {
          backgroundColor: palette.accent,
          borderColor: palette.accentLight,
          shadowColor: palette.accent,
        },
      ]}
    >
      <View
        className={`w-[32px] rounded-[16px] items-center justify-center ${
          compact ? 'h-[26px]' : 'h-[30px]'
        }`}
      >
        {activeAnalysis ? (
          <ActivityIndicator size="small" color={palette.textOnAccentSurface} />
        ) : (
          <IconSymbol
            size={24}
            name="pencil"
            color={palette.textOnAccentSurface}
          />
        )}
      </View>
      <Text
        className={`w-full min-w-0 shrink text-center font-sans-bold ${
          compact ? 'text-[11px]' : narrow ? 'text-[11px]' : 'text-[12px]'
        }`}
        style={{ color: palette.textOnAccentSurface }}
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={narrow ? 0.75 : 0.85}
        maxFontSizeMultiplier={narrow ? 1.3 : undefined}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const segments = useSegments();
  const { routeCommitted } = useStartupRoute();

  // Expo Router anchors the root stack on `(tabs)`. During a cold-start guard,
  // keep that transient route free of Moti/Reanimated work; otherwise its home
  // card animations can target Fabric views after the redirect detaches them.
  const isTabsDestination = segments[0] === '(tabs)';
  if (!routeCommitted || !isTabsDestination) {
    return (
      <View
        importantForAccessibility="no-hide-descendants"
        className="flex-1"
        style={{ backgroundColor: noctalia.screen.background }}
      />
    );
  }

  const navigationLayout = getBottomNavigationLayout(width, height);
  const floatingBottomInset = Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const palette: TabPalette = {
    barBg: noctalia.nav.background,
    barBorder: noctalia.nav.border,
    accent: noctalia.action.primary,
    accentLight: noctalia.action.primaryBorder,
    textOnAccentSurface: noctalia.action.primaryText,
    text: noctalia.nav.inactive,
    textActive: noctalia.nav.active,
  };

  const handleAddDreamPress = () => {
    router.push('/recording');
  };

  const baseTabBarStyle: ViewStyle = {
    position: 'absolute',
    bottom: floatingBottomInset,
    ...getTabBarHorizontalLayout(width),
    backgroundColor: palette.barBg,
    height: navigationLayout.barHeight,
    paddingHorizontal: navigationLayout.narrow ? 4 : 8,
    paddingTop: navigationLayout.compact ? 4 : 7,
    paddingBottom: navigationLayout.compact ? 4 : 7,
    borderRadius: navigationLayout.compact ? 28 : 36,
    borderWidth: 1,
    borderTopColor: palette.barBorder,
    borderColor: palette.barBorder,
    shadowColor: noctalia.screen.background,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
    overflow: 'visible',
  };

  // The blocked returning-guest state is a standalone authentication surface.
  // Keeping a single Settings tab visible adds no navigation value and can
  // cover the privacy controls at the bottom of the screen.
  const tabBarStyle: ViewStyle | { display: 'none' } = isDesktopWeb || returningGuestBlocked
    ? { display: 'none' }
    : baseTabBarStyle;

  const tabs = (
    <Tabs
      screenOptions={{
        // Tabs are peers, not a hierarchy, and the user pays for this transition dozens
        // of times a session. `none` is also the navigator default — pinned explicitly so
        // a future default change cannot start sliding the most-used surface in the app.
        animation: 'none',
        sceneStyle: {
          backgroundColor: noctalia.screen.background,
        },
        headerShown: false,
        tabBarIconStyle: {
          flex: 1,
          width: '100%',
          height: '100%',
        },
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          flex: 1,
          height: '100%',
        },
        tabBarStyle,
      }}>
      <Tabs.Screen
        name="index"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.home'),
        } : {
          title: t('nav.home'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Home} accessibilityLabel={t('nav.home')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="house" label={t('nav.home')} focused={focused} palette={palette} compact={navigationLayout.compact} narrow={navigationLayout.narrow} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.journal'),
        } : {
          title: t('nav.journal'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Journal} accessibilityLabel={t('nav.journal')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="book" label={t('nav.journal')} focused={focused} palette={palette} compact={navigationLayout.compact} narrow={navigationLayout.narrow} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-dream"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.capture_dream'),
        } : {
          title: t('nav.capture_dream'),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={handleAddDreamPress}
              testID={TID.Tab.AddDream}
              accessibilityLabel={t('nav.capture_dream_accessibility')}
            />
          ),
          tabBarIcon: () => (
            <AddDreamTabItem label={t('nav.capture_dream')} palette={palette} compact={navigationLayout.compact} narrow={navigationLayout.narrow} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.stats'),
        } : {
          title: t('nav.stats'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Stats} accessibilityLabel={t('nav.stats')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="chart.bar" label={t('nav.stats')} focused={focused} palette={palette} compact={navigationLayout.compact} narrow={navigationLayout.narrow} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={returningGuestBlocked ? {
          title: t('nav.settings'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Settings} accessibilityLabel={t('nav.settings')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="gear" label={t('nav.settings')} focused={focused} palette={palette} compact={navigationLayout.compact} narrow={navigationLayout.narrow} />
          ),
        } : {
          href: null,
          title: t('nav.settings'),
        }}
      />
    </Tabs>
  );

  // Desktop web layout with sidebar
  if (isDesktopWeb) {
    return (
      <View className="flex-1 flex-row">
        <DesktopSidebar />
        <View className="flex-1">
          {tabs}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: noctalia.screen.background }}>
      {tabs}
    </View>
  );
}

/**
 * The capture button's lift. This stays a real `transform` rather than a
 * `-translate-y-*` class: Tailwind v4 emits `translate` through CSS variables and
 * Uniwind resolves that declaration by splitting the string, so the variable form
 * would not survive. Everything else on this button is a className.
 */
const ADD_TAB_LIFT = {
  default: { transform: [{ translateY: -8 }] },
  compact: { transform: [{ translateY: -4 }] },
  narrow: { transform: [{ translateY: -6 }] },
} satisfies Record<string, ViewStyle>;

/**
 * React Native spreads a shadow across `shadow*` plus Android `elevation`; Tailwind's
 * single `box-shadow` does not map onto that without changing how Android renders it.
 * The colour is per-theme, so it is merged at the call site.
 */
const ADD_TAB_SHADOW = {
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.24,
  shadowRadius: 14,
  elevation: 8,
} satisfies ViewStyle;
