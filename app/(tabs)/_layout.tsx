import { Tabs, router, useSegments } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import React, { createRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { BOTTOM_NAV_HREFS } from '@/components/navigation/NoctaliaBottomNav';
import { ActiveTabPill, TabBarGlass, type BlurTarget } from '@/components/navigation/TabBarGlass';
import { CAPTURE_GLOW, getActivePillFrame, getCaptureAction, getCaptureOverhang, getIconSlotSize, getTabBarFrame } from '@/components/navigation/tabBarMetrics';
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
import { useContentWindow } from '@/context/ContentWindowContext';
import { useSideColumnTabBar } from '@/context/SideColumnTabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBorder: string;
  accent: string;
  accentLight: string;
  textOnAccentSurface: string;
  text: string;
  textActive: string;
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

// Five destinations; the active background reaches into its neighbours by index.
const TAB_COUNT = 5;
// Each cell keeps 1 point on both sides and drops the navigator's vertical
// padding, so the active background can fill the bar's height.
const TAB_CELL_INSET = 1;
const TAB_CELL_PADDING = { paddingHorizontal: TAB_CELL_INSET, paddingVertical: 0 } as const;

function TabBarItem({ label, icon, activeIcon, focused, palette, geometry, index }: {
  index: number;
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
        height: '100%',
      }}
      className={`min-w-0 items-center justify-center ${
        compact ? 'gap-0 py-0.5' : 'gap-[2px] py-1'
      }`}
    >
      {focused ? (
        <ActiveTabPill style={getActivePillFrame(geometry, index, TAB_COUNT, TAB_CELL_INSET)} />
      ) : null}
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
        // Android ignores minimumFontScale, so fitting there shrinks labels without a floor.
        adjustsFontSizeToFit={Platform.OS !== 'android'}
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
        height: '100%',
      }}
      className={`min-w-0 items-center justify-center ${
        compact ? 'gap-0 py-0.5' : 'gap-[2px] py-1'
      }`}
    >
      {/* Raised, the action itself carries the emphasis; a pill behind it would compete. */}
      {focused && !action.raised ? (
        <ActiveTabPill style={getActivePillFrame(geometry, 2, TAB_COUNT, TAB_CELL_INSET)} />
      ) : null}
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
        // Android ignores minimumFontScale, so fitting there shrinks labels without a floor.
        adjustsFontSizeToFit={Platform.OS !== 'android'}
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
        style={[props.style, TAB_CELL_PADDING]}
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
  const { width, height, fontScale } = useContentWindow();
  const segments = useSegments();
  const { routeCommitted } = useStartupRoute();
  const { activeAnalysis } = useAnalysisActivity();
  const isTabsDestination = segments[0] === '(tabs)';
  const [hasEnteredTabs, setHasEnteredTabs] = useState(false);
  const keyboardVisible = useKeyboardVisible();
  // Android blurs only a declared target: each tab screen is one, and the bar blurs the focused one.
  const blurTargets = useRef(new Map<string, BlurTarget>()).current;
  // Tab route names match the second segment; the index tab has none.
  const focusedTab = (segments as readonly string[])[1] ?? 'index';
  const blurTargetFor = (name: string) => {
    let target = blurTargets.get(name);
    if (!target) {
      target = createRef();
      blurTargets.set(name, target);
    }
    return target;
  };

  // The iPhone Duo's side column takes the navigation once the tabs are on show and have one.
  const tabsShown = hasEnteredTabs || (routeCommitted && isTabsDestination);
  const barInSideColumn = useSideColumnTabBar('tabs', tabsShown && !returningGuestBlocked && !keyboardVisible ? {
    onSelect: (key) => {
      if (key === 'addDream') router.push('/recording');
      else router.navigate(BOTTOM_NAV_HREFS[key]);
    },
  } : null);

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
  const barFrame = getTabBarFrame(navigationLayout);
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const palette: TabPalette = {
    barBorder: noctalia.nav.glass.rim,
    accent: noctalia.action.primary,
    accentLight: noctalia.action.primaryBorder,
    textOnAccentSurface: noctalia.action.primaryText,
    text: noctalia.nav.inactive,
    textActive: noctalia.nav.active,
    ground: noctalia.screen.background,
  };

  const handleAddDreamPress = () => {
    router.push('/recording');
  };

  const baseTabBarStyle: ViewStyle = {
    position: 'absolute',
    bottom: floatingBottomInset,
    ...getTabBarHorizontalLayout(width),
    // The glass behind the tabs is drawn by `tabBarBackground`.
    backgroundColor: 'transparent',
    height: navigationLayout.barHeight,
    paddingHorizontal: barFrame.paddingHorizontal,
    paddingTop: barFrame.paddingVertical,
    paddingBottom: barFrame.paddingVertical,
    borderRadius: barFrame.borderRadius,
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
      // In the Duo's side column the root shell draws the navigation; none at the bottom.
      tabBar={barInSideColumn ? () => null : undefined}
      screenLayout={Platform.OS === 'android' ? ({ children, route }) => (
        <BlurTargetView ref={blurTargetFor(route.name)} collapsable={false} style={{ flex: 1 }}>
          {children}
        </BlurTargetView>
      ) : undefined}
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
        // The navigator's own keyboard state takes the keyboard of no height that a fold of the
        // iPhone Duo reports for a real one, and keeps the bar hidden: it hides only while this
        // layout sees a keyboard too.
        tabBarHideOnKeyboard: keyboardVisible,
        tabBarBackground: () => (
          <TabBarGlass
            borderRadius={barFrame.borderRadius}
            blurTarget={Platform.OS === 'android' ? blurTargetFor(focusedTab) : undefined}
          />
        ),
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
            <TabBarItem index={0} icon="house" activeIcon="house.fill" label={t(navigationLayout.compactLabels ? 'nav.home_compact' : 'nav.home')} focused={focused} palette={palette} geometry={geometry} />
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
            <TabBarItem index={1} icon="book" activeIcon="book.fill" label={t('nav.journal')} focused={focused} palette={palette} geometry={geometry} />
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
              style={[props.style, TAB_CELL_PADDING]}
              onPress={handleAddDreamPress}
              testID={TID.Tab.AddDream}
              accessibilityRole="tab"
              accessibilityLabel={t('nav.capture_dream_accessibility')}
              accessibilityBusy={Boolean(activeAnalysis)}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <AddDreamTabItem focused={focused} label={t(navigationLayout.compactLabels ? 'nav.capture_dream_compact' : 'nav.capture_dream')} palette={palette} geometry={geometry} />
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
            <TabBarItem index={3} icon="chart.line.uptrend.xyaxis" label={t(navigationLayout.compactLabels ? 'nav.stats_compact' : 'nav.stats')} focused={focused} palette={palette} geometry={geometry} />
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
            <TabBarItem index={4} icon="sparkles" label={t(navigationLayout.compactLabels ? 'nav.explore_compact' : 'nav.explore')} focused={focused} palette={palette} geometry={geometry} />
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
      {!isDesktopWeb && !returningGuestBlocked && !keyboardVisible && !barInSideColumn && getCaptureAction(navigationLayout).raised ? (
        // This touch surface is inside the full-screen parent, so Android can hit
        // the artwork above the tab row. hitSlop on that row is clipped by its bounds.
        <Pressable accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          focusable={false} onPress={handleAddDreamPress} testID="tab.addDream.overhang"
          style={{ position: 'absolute', bottom: floatingBottomInset + navigationLayout.barHeight,
            left: (width - getCaptureAction(navigationLayout).size) / 2,
            width: getCaptureAction(navigationLayout).size, height: getCaptureOverhang(navigationLayout),
            zIndex: 46, elevation: 15 }} />
      ) : null}
    </View>
  );
}
