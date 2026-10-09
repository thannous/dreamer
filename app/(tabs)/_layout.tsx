import { Tabs, router, useSegments } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { ACTIVE_PILL_RADIUS, CAPTURE_GLOW, getCaptureAction, getCaptureOverhang, getIconSlotSize } from '@/components/navigation/tabBarMetrics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER,
  DESKTOP_BREAKPOINT,
  DESKTOP_CONTENT_MAX_WIDTH,
  getBottomNavigationLayout,
  getBottomNavigationItemStyle,
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
  activeFill: string;
  ground: string;
};

type TabGeometry = {
  compact: boolean;
  narrow: boolean;
  stackedLabels: boolean;
  largeText: boolean;
  labelFontSize: number;
  labelLineHeight: number;
  labelLines: number;
  labelHeight: number;
  centerLabelLines: number;
  centerLabelHeight: number;
  itemWidth: number;
};

function TabBarItem({ label, icon, activeIcon, focused, palette, geometry }: {
  label: string;
  icon: IconName;
  activeIcon?: IconName;
  focused: boolean;
  palette: TabPalette;
  geometry: TabGeometry;
}) {
  const { compact, narrow, stackedLabels } = geometry;
  // Web Text cannot shrink to fit; use the available cell without the native inset.
  const labelWidth = geometry.itemWidth - (Platform.OS === 'web' || geometry.largeText ? 2 : 0);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      // React Navigation centers this custom icon in an absolute wrapper.
      // A percentage on the Text alone cannot bound its intrinsic parent width.
      style={{
        width: labelWidth,
        maxWidth: '100%',
        borderRadius: ACTIVE_PILL_RADIUS[compact ? 'compact' : 'default'],
        backgroundColor: focused ? palette.activeFill : 'transparent',
      }}
      className={`min-w-0 items-center justify-center ${
        compact ? 'gap-0 py-0.5' : 'gap-[2px] py-1'
      }`}
    >
      {/* Same slot height as the Capture action so every label shares one baseline. */}
      <View className="items-center justify-center" style={{ height: getIconSlotSize(geometry) }}>
        <IconSymbol
          size={24}
          name={focused && activeIcon ? activeIcon : icon}
          color={focused ? palette.textActive : palette.text}
        />
      </View>
      <Text
        accessible={false}
        className="w-full min-w-0 shrink text-center font-sans-medium"
        style={{
          color: focused ? palette.textActive : palette.text,
          fontSize: geometry.labelFontSize,
          lineHeight: geometry.labelLineHeight,
          height: stackedLabels ? geometry.labelHeight : undefined,
          width: labelWidth,
          maxWidth: '100%',
        }}
        numberOfLines={geometry.labelLines}
        textBreakStrategy="simple"
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        maxFontSizeMultiplier={BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER}
        minimumFontScale={narrow ? 0.75 : 0.8}
      >
        {label}
      </Text>
    </View>
  );
}

function AddDreamTabItem({ label, palette, geometry, focused }: {
  focused: boolean;
  label: string;
  palette: TabPalette;
  geometry: TabGeometry;
}) {
  // While a dream analysis runs in the background, the Capture button carries
  // the in-progress state so no overlay has to cover the screen content.
  const { activeAnalysis } = useAnalysisActivity();
  const { compact, narrow, stackedLabels } = geometry;
  const action = getCaptureAction(geometry);
  const labelWidth = geometry.itemWidth - (Platform.OS === 'web' || geometry.largeText ? 2 : 0);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: labelWidth,
        maxWidth: '100%',
        borderRadius: ACTIVE_PILL_RADIUS[compact ? 'compact' : 'default'],
        // Raised, the action itself carries the emphasis; a pill behind it would compete.
        backgroundColor: focused && !action.raised ? palette.activeFill : 'transparent',
      }}
      className={`min-w-0 items-center justify-center ${
        compact ? 'gap-0 py-0.5' : 'gap-[2px] py-1'
      }`}
    >
      {/* The primary action reads as one at rest, not only once selected. The ring
          takes the screen colour so the raised part looks cut out of the bar. */}
      <View
        className="items-center justify-center"
        style={[
          action.style,
          { backgroundColor: palette.accent, borderColor: palette.ground },
          action.raised && { ...CAPTURE_GLOW, shadowColor: palette.accent },
        ]}
      >
        {activeAnalysis ? (
          <ActivityIndicator size="small" color={palette.textOnAccentSurface} />
        ) : (
          <IconSymbol
            size={action.iconSize}
            name="pencil"
            color={palette.textOnAccentSurface}
          />
        )}
      </View>
      <Text
        accessible={false}
        className="w-full min-w-0 shrink text-center font-sans-medium"
        style={{
          color: focused ? palette.textActive : palette.text,
          fontSize: geometry.labelFontSize,
          lineHeight: geometry.labelLineHeight,
          height: stackedLabels ? geometry.centerLabelHeight : undefined,
          width: labelWidth,
          maxWidth: '100%',
        }}
        numberOfLines={geometry.centerLabelLines}
        textBreakStrategy="simple"
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        maxFontSizeMultiplier={BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER}
        minimumFontScale={narrow ? 0.75 : 0.85}
      >
        {label}
      </Text>
    </View>
  );
}

function createTabButton({
  testID,
  accessibilityLabel,
  busy = false,
}: {
  testID: string;
  accessibilityLabel: string;
  busy?: boolean;
}) {
  return function TabButton(props: React.ComponentProps<typeof HapticTab>) {
    return (
      <HapticTab
        {...props}
        style={[props.style, { paddingHorizontal: 1 }]}
        testID={testID}
        accessibilityRole="tab"
        accessibilityLabel={accessibilityLabel}
        accessibilityBusy={busy}
      />
    );
  };
}

export default function TabLayout() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const segments = useSegments();
  const { routeCommitted } = useStartupRoute();
  const { activeAnalysis } = useAnalysisActivity();
  const isTabsDestination = segments[0] === '(tabs)';
  const [hasEnteredTabs, setHasEnteredTabs] = useState(false);

  useEffect(() => {
    if (routeCommitted && isTabsDestination) {
      // Navigation-lifetime latch: once tabs are actually entered, keep that
      // navigator instance across later root-resource pushes. This is not derived
      // render state, so an effect is required; never reset it on a resource push.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- parent-approved latch
      setHasEnteredTabs(true);
    }
  }, [routeCommitted, isTabsDestination]);

  // Expo Router anchors the root stack on `(tabs)`. During a cold-start guard,
  // keep that transient route free of Moti/Reanimated work until tabs are
  // actually entered; otherwise home card animations can target Fabric views
  // after the redirect detaches them. After the first committed tabs visit,
  // keep the navigator mounted so a root resource push cannot reset tab state.
  if (!hasEnteredTabs && (!routeCommitted || !isTabsDestination)) {
    return (
      <View
        importantForAccessibility="no-hide-descendants"
        className="flex-1"
        style={{ backgroundColor: noctalia.screen.background }}
      />
    );
  }

  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const geometry: TabGeometry = {
    compact: navigationLayout.compact,
    narrow: navigationLayout.narrow,
    stackedLabels: navigationLayout.stackedLabels,
    largeText: navigationLayout.largeText,
    labelFontSize: navigationLayout.labelFontSize,
    labelLineHeight: navigationLayout.labelLineHeight,
    labelLines: navigationLayout.labelLines,
    labelHeight: navigationLayout.labelHeight,
    centerLabelLines: navigationLayout.centerLabelLines,
    centerLabelHeight: navigationLayout.centerLabelHeight,
    itemWidth: navigationLayout.itemWidth,
  };
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
    activeFill: noctalia.surface.active,
    ground: noctalia.screen.background,
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
    borderWidth: StyleSheet.hairlineWidth,
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
        sceneStyle: isDesktopWeb ? {
          backgroundColor: noctalia.screen.background,
          // The sidebar lives in the root shell. Cap tab pages at a reading
          // width so lists and recaps do not stretch across a wide window.
          width: '100%',
          maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        } : {
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
          tabBarButton: createTabButton({
            testID: TID.Tab.Home,
            accessibilityLabel: t('nav.home'),
          }),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="house" activeIcon="house.fill" label={t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.home_compact' : 'nav.home')} focused={focused} palette={palette} geometry={geometry} />
          ),
          tabBarItemStyle: getBottomNavigationItemStyle(0, navigationLayout),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.journal'),
        } : {
          title: t('nav.journal'),
          tabBarButton: createTabButton({
            testID: TID.Tab.Journal,
            accessibilityLabel: t('nav.journal'),
          }),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="book" activeIcon="book.fill" label={t('nav.journal')} focused={focused} palette={palette} geometry={geometry} />
          ),
          tabBarItemStyle: getBottomNavigationItemStyle(1, navigationLayout),
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
              style={[props.style, { paddingHorizontal: 1 }]}
              onPress={handleAddDreamPress}
              // The raised action rises above the bar; keep that part tappable.
              hitSlop={{ top: getCaptureOverhang(navigationLayout) }}
              testID={TID.Tab.AddDream}
              accessibilityRole="tab"
              accessibilityLabel={t('nav.capture_dream_accessibility')}
              accessibilityBusy={Boolean(activeAnalysis)}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <AddDreamTabItem focused={focused} label={t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.capture_dream_compact' : 'nav.capture_dream')} palette={palette} geometry={geometry} />
          ),
          tabBarItemStyle: getBottomNavigationItemStyle(2, navigationLayout),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.stats'),
        } : {
          title: t('nav.stats'),
          tabBarButton: createTabButton({
            testID: TID.Tab.Stats,
            accessibilityLabel: t('nav.stats'),
          }),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="chart.bar" activeIcon="chart.bar.fill" label={t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.stats_compact' : 'nav.stats')} focused={focused} palette={palette} geometry={geometry} />
          ),
          tabBarItemStyle: getBottomNavigationItemStyle(3, navigationLayout),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.explore'),
        } : {
          title: t('nav.explore'),
          tabBarButton: createTabButton({
            testID: TID.Tab.Explore,
            accessibilityLabel: t('nav.explore'),
          }),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="sparkles" label={t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.explore_compact' : 'nav.explore')} focused={focused} palette={palette} geometry={geometry} />
          ),
          tabBarItemStyle: getBottomNavigationItemStyle(4, navigationLayout),
        }}
      />
    </Tabs>
  );

  // The desktop sidebar is rendered by the root shell so Capture and Settings
  // keep it too. Keep this wrapper stable across the breakpoint: a different
  // parent would remount the navigator and reset the selected tab.
  return (
    <View className="flex-1" style={{ flex: 1, backgroundColor: noctalia.screen.background }}>
      {tabs}
    </View>
  );
}
