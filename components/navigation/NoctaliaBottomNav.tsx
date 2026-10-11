import { ACTIVE_PILL_RADIUS, CAPTURE_GLOW, getCaptureAction, getCaptureOverhang, getIconSlotSize } from '@/components/navigation/tabBarMetrics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER,
  DESKTOP_BREAKPOINT,
  getBottomNavigationLayout,
  getBottomNavigationItemStyle,
  getTabBarHorizontalLayout,
} from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];
type BottomNavKey = 'home' | 'journal' | 'addDream' | 'stats' | 'explore';

type BottomNavItem = {
  key: BottomNavKey;
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  activeIcon?: IconName;
  href: Href;
  testID: string;
};

type NoctaliaBottomNavProps = {
  activeKey: BottomNavKey;
  addDreamIcon?: IconName;
  onBarLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Shadows have no `global.css` token — RN spreads a shadow over five properties
 * (`shadowColor/Offset/Opacity/Radius` plus Android `elevation`) that Tailwind's single
 * `box-shadow` does not map onto without changing how Android draws it. They stay here.
 */
const BAR_SHADOW: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.22,
  shadowRadius: 24,
  elevation: 14,
};

export function NoctaliaBottomNav({
  activeKey,
  addDreamIcon = 'pencil',
  onBarLayout,
}: NoctaliaBottomNavProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  // The Capture button doubles as the in-progress indicator for a background
  // dream analysis, so no overlay has to cover the screen content.
  const { activeAnalysis } = useAnalysisActivity();

  if (Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT) {
    return null;
  }

  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const floatingBottomInset = Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  // Icon and indicator colours are values on native props, so they stay on the tokens.
  const navActiveColor = noctalia.nav.active;
  const navInactiveColor = noctalia.nav.inactive;
  const iconSlotSize = getIconSlotSize(navigationLayout);
  const captureAction = getCaptureAction(navigationLayout);
  const captureOverhang = getCaptureOverhang(navigationLayout);
  // Callers keep content above the bar; report the raised Capture action's top as the bar's top.
  const handleBarLayout = onBarLayout && captureOverhang
    ? (event: LayoutChangeEvent) => onBarLayout({
      ...event,
      nativeEvent: { ...event.nativeEvent, layout: { ...event.nativeEvent.layout, y: event.nativeEvent.layout.y - captureOverhang } },
    })
    : onBarLayout;
  const horizontalLayout = getTabBarHorizontalLayout(width);

  const barClassName = [
    'absolute flex-row border-line-nav bg-ink-nav',
    navigationLayout.compact ? 'rounded-[28px] py-1' : 'rounded-[36px] py-[7px]',
    navigationLayout.narrow ? 'px-1' : 'px-2',
  ].join(' ');

  const labelStyle = {
    fontSize: navigationLayout.labelFontSize,
    lineHeight: navigationLayout.labelLineHeight,
    height: navigationLayout.stackedLabels ? navigationLayout.labelHeight : undefined,
  };

  const labelSizeClassName = navigationLayout.narrow
    ? 'text-[11px] px-px'
    : navigationLayout.compact
      ? 'text-[11px]'
      : 'text-[12px]';

  const items: BottomNavItem[] = [
    {
      key: 'home',
      label: t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.home_compact' : 'nav.home'),
      accessibilityLabel: t('nav.home'),
      icon: 'house',
      activeIcon: 'house.fill',
      href: '/(tabs)',
      testID: TID.Tab.Home,
    },
    {
      key: 'journal',
      label: t('nav.journal'),
      accessibilityLabel: t('nav.journal'),
      icon: 'book',
      activeIcon: 'book.fill',
      href: '/(tabs)/journal',
      testID: TID.Tab.Journal,
    },
    {
      key: 'addDream',
      label: t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.capture_dream_compact' : 'nav.capture_dream'),
      accessibilityLabel: t('nav.capture_dream_accessibility'),
      icon: addDreamIcon,
      href: '/recording',
      testID: TID.Tab.AddDream,
    },
    {
      key: 'stats',
      label: t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.stats_compact' : 'nav.stats'),
      accessibilityLabel: t('nav.stats'),
      icon: 'chart.bar',
      activeIcon: 'chart.bar.fill',
      href: '/(tabs)/statistics',
      testID: TID.Tab.Stats,
    },
    {
      key: 'explore',
      label: t((navigationLayout.largeText || navigationLayout.narrow) ? 'nav.explore_compact' : 'nav.explore'),
      accessibilityLabel: t('nav.explore'),
      icon: 'sparkles',
      // Keep the nested tab state explicit. When this bar is used from Capture,
      // a resource route can now return to Explorer instead of the default Today tab.
      href: '/(tabs)/explore',
      testID: TID.Tab.Explore,
    },
  ];

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-[45]">
      <View
        onLayout={handleBarLayout}
        className={barClassName}
        style={[
          BAR_SHADOW,
          {
            borderWidth: StyleSheet.hairlineWidth,
            bottom: floatingBottomInset,
            height: navigationLayout.barHeight,
            ...horizontalLayout,
          },
        ]}
      >
        <View className="relative flex-1 flex-row">
          {items.map((item, index) => {
            const isCenter = item.key === 'addDream';
            const isActive = item.key === activeKey;

            return (
              <Pressable
                key={item.key}
                // Capture sits above the tab navigator. Return to that instance so
                // repeated tab switches release Capture instead of stacking both.
                onPress={isActive ? undefined : () => router.dismissTo(item.href)}
                accessibilityRole="tab"
                aria-selected={isActive}
                aria-busy={isCenter ? Boolean(activeAnalysis) : undefined}
                accessibilityState={{
                  selected: isActive,
                  busy: isCenter ? Boolean(activeAnalysis) : undefined,
                }}
                accessibilityLabel={item.accessibilityLabel}
                testID={item.testID}
                style={[
                  { width: navigationLayout.itemWidth },
                  getBottomNavigationItemStyle(index, navigationLayout),
                ]}
                className="h-full min-w-0 flex-1 items-center justify-center active:opacity-[0.72]"
              >
                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: navigationLayout.itemWidth - (Platform.OS === 'web' || navigationLayout.largeText ? 2 : 0),
                    maxWidth: '100%',
                    borderRadius: ACTIVE_PILL_RADIUS[navigationLayout.compact ? 'compact' : 'default'],
                  }}
                  className={`min-w-0 items-center justify-center ${
                    navigationLayout.compact ? 'gap-0 py-0.5' : 'gap-[2px] py-1'
                  } ${isActive && !(isCenter && captureAction.raised) ? 'bg-ink-active' : ''}`}
                >
                  {isCenter ? (
                    // The primary action reads as one at rest, not only once selected. The ring
                    // takes the screen colour so the raised part looks cut out of the bar.
                    <View
                      className="items-center justify-center border-ink bg-champagne"
                      style={[
                        captureAction.style,
                        captureAction.raised && { ...CAPTURE_GLOW, shadowColor: noctalia.action.primary },
                      ]}
                    >
                      {activeAnalysis ? (
                        <ActivityIndicator size="small" color={noctalia.action.primaryText} />
                      ) : (
                        <IconSymbol
                          size={captureAction.iconSize}
                          name={item.icon}
                          color={noctalia.action.primaryText}
                        />
                      )}
                    </View>
                  ) : (
                    <View className="items-center justify-center" style={{ height: iconSlotSize }}>
                      <IconSymbol
                        size={24}
                        name={isActive && item.activeIcon ? item.activeIcon : item.icon}
                        color={isActive ? navActiveColor : navInactiveColor}
                      />
                    </View>
                  )}
                  <Text
                    accessible={false}
                    className={`w-full min-w-0 shrink text-center font-sans-medium ${labelSizeClassName} ${
                      isActive ? 'text-nav-active' : 'text-nav-inactive'
                    }`}
                    style={[
                      labelStyle,
                      {
                        height: navigationLayout.stackedLabels
                          ? isCenter ? navigationLayout.centerLabelHeight : navigationLayout.labelHeight
                          : undefined,
                        width: navigationLayout.itemWidth - (Platform.OS === 'web' || navigationLayout.largeText ? 2 : 0),
                        maxWidth: '100%',
                      },
                    ]}
                    numberOfLines={isCenter ? navigationLayout.centerLabelLines : navigationLayout.labelLines}
                    textBreakStrategy="simple"
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    maxFontSizeMultiplier={BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER}
                    minimumFontScale={navigationLayout.narrow ? 0.75 : isCenter ? 0.85 : 0.8}
                  >
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      {captureAction.raised ? <Pressable accessible={false} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants" focusable={false}
        onPress={activeKey === 'addDream' ? undefined : () => router.dismissTo('/recording')}
        testID="tab.addDream.overhang"
        style={{ position: 'absolute', bottom: floatingBottomInset + navigationLayout.barHeight,
          left: (width - captureAction.size) / 2, width: captureAction.size, height: captureOverhang,
          zIndex: 46, elevation: 15 }} /> : null}
    </View>
  );
}
