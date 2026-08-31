import { BlurView } from 'expo-blur';
import { Tabs, useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import React from 'react';
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ColorValue,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { CompactTabBar, TabBar } from '@/constants/layout';

import { IconSymbol } from '@/components/ui';
import { usePressMotion } from '@/hooks/usePressMotion';
import { Radius } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useChromeTheme } from '@/hooks/useChromeTheme';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { accessibleTabBarHeight } from '@/hooks/useTabBarInset';

/**
 * Four tabs, in a pill that floats over the screen.
 *
 * The bar is absolutely positioned so the atmosphere keeps running underneath
 * it instead of stopping at a hard edge — which is the whole reason the surface
 * reads as glass. Nothing reserves that space in layout any more, so every tab
 * screen pads its scroll view by `useTabBarInset()`.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabLabelProps = {
  children: string;
  color: ColorValue;
  compact: boolean;
  fontScale: number;
  maxWidth: number;
  testID?: string;
};

/**
 * Width budget of one tab name. TalkBack still reads the unsplit label on the
 * parent tab, so this never changes the accessible name.
 */
export function tabLabelMaxWidth(screenWidth: number, tabCount: number, compact: boolean): number {
  const margin = compact ? CompactTabBar.margin : TabBar.margin;
  return Math.max(48, Math.floor((screenWidth - margin * 2) / Math.max(tabCount, 1)) - 8);
}

/**
 * Keep every tab name at the user's requested font scale. Labels wrap at a
 * space when possible; a long single word is balanced over two visual lines.
 * TalkBack still reads the complete, unsplit title from the parent tab.
 */
export function reflowTabLabel(label: string, fontScale: number, maxWidth: number): string {
  if (fontScale < 1.5) return label;

  const characters = Array.from(label);
  const estimatedWidth = Math.ceil(characters.length * 11 * fontScale * 0.62);
  if (estimatedWidth <= maxWidth) return label;

  const space = label.search(/\s/);
  if (space < 1) {
    const splitAt = Math.ceil(characters.length / 2);
    return `${characters.slice(0, splitAt).join('')}\n${characters.slice(splitAt).join('')}`;
  }

  return `${label.slice(0, space)}\n${label.slice(space + 1).trimStart()}`;
}

/** Keep every tab name visible at Android font scales up to and beyond 200%. */
export function TabLabel({ children, color, compact, fontScale, maxWidth, testID }: TabLabelProps) {
  const fontSize = compact ? 11 : 12;
  const wrapped = reflowTabLabel(children, fontScale, maxWidth);
  const multiline = wrapped.includes('\n');

  return (
    <Text
      testID={testID}
      allowFontScaling
      numberOfLines={multiline ? 2 : 1}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{
        color,
        width: maxWidth,
        flexShrink: 1,
        fontFamily: FontFamily.medium,
        fontSize,
        lineHeight: Math.ceil((compact ? 12 : 14) * fontScale),
        textAlign: 'center',
      }}>
      {wrapped}
    </Text>
  );
}

type RouterTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

function tabIconName(routeName: string) {
  switch (routeName) {
    case 'breathe':
      return 'wind' as const;
    case 'search':
      return 'magnifyingglass' as const;
    case 'profile':
      return 'person' as const;
    default:
      return 'house' as const;
  }
}

/** A wrapping tab bar; React Navigation's stock label is hard-coded to one line. */
export function AccessibleTabBar({ state, descriptors, navigation, insets }: RouterTabBarProps) {
  const { colors, mode } = useChromeTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = useCompactLayout();
  const tabBar = compact ? CompactTabBar : TabBar;
  const tabBarHeight = accessibleTabBarHeight(tabBar.height, fontScale);
  const iconSize = compact ? 20 : 22;
  const labelMaxWidth = tabLabelMaxWidth(width, state.routes.length, compact);

  return (
    <View
      role="tablist"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: compact ? 3 : 6,
      }}>
      <BlurView
        intensity={mode === 'dark' ? 32 : 40}
        tint={mode === 'dark' ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          left: tabBar.margin,
          right: tabBar.margin,
          top: 0,
          bottom: Math.max(insets.bottom - tabBar.margin, tabBar.margin),
          backgroundColor: colors.navbarBg,
          borderColor: colors.navbarBorder,
          borderWidth: 1,
          borderRadius: Radius.full,
          overflow: 'hidden',
        }}
      />
      <View className="flex-1 flex-row" style={{ paddingHorizontal: tabBar.margin }}>
        {state.routes.map((route) => {
          const focused = state.routes[state.index].key === route.key;
          const options = descriptors[route.key].options;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.textPrimary : colors.textTertiary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={{ selected: focused }}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
              <IconSymbol name={tabIconName(route.name)} color={color} size={iconSize} />
              <TabLabel
                compact={compact}
                fontScale={fontScale}
                color={color}
                maxWidth={labelMaxWidth}
                testID={options.tabBarButtonTestID ? `${options.tabBarButtonTestID}.label` : undefined}>
                {label}
              </TabLabel>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Opens the drawer from anywhere in the tabs.
 *
 * Rendered here rather than in each of the four screens: it belongs to the tab
 * shell, not to any one screen, and the top-right corner is free on all of
 * them. This layout is the drawer's own screen, so `useNavigation` hands back
 * the drawer's navigation directly — no reaching for a parent by id.
 */
export function DrawerButton() {
  const { t } = useTranslation();
  const { colors, mode } = useChromeTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={t('drawer.open')}
      testID="btn.drawer.open"
      onPress={() => navigation.openDrawer()}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
      style={[style, { position: 'absolute', right: 20, top: insets.top + 8, zIndex: 20, height: 48, width: 48 }]}>
      <BlurView
        intensity={mode === 'dark' ? 32 : 40}
        tint={mode === 'dark' ? 'dark' : 'light'}
        style={{
          height: 48,
          width: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Radius.full,
          borderColor: colors.navbarBorder,
          borderWidth: 1,
          backgroundColor: colors.navbarBg,
          overflow: 'hidden',
        }}>
        <IconSymbol name="line.3.horizontal" size={19} color={colors.textPrimary} />
      </BlurView>
    </AnimatedPressable>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const compact = useCompactLayout();
  const tabBar = compact ? CompactTabBar : TabBar;
  const tabBarHeight = accessibleTabBarHeight(tabBar.height, fontScale);
  const iconSize = compact ? 20 : 22;

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => <AccessibleTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: 'transparent' },
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: t('tabs.home'),
              tabBarAccessibilityLabel: t('tabs.home'),
              tabBarButtonTestID: TID.Tab.Home,
            }}
          />
          <Tabs.Screen
            name="breathe"
            options={{
              title: t('tabs.breathe'),
              tabBarAccessibilityLabel: t('tabs.breathe'),
              tabBarButtonTestID: TID.Tab.Breathe,
              tabBarIcon: ({ color }) => <IconSymbol name="wind" color={color} size={iconSize} />,
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: t('tabs.search'),
              tabBarAccessibilityLabel: t('tabs.search'),
              tabBarButtonTestID: TID.Tab.Search,
              tabBarIcon: ({ color }) => (
                <IconSymbol name="magnifyingglass" color={color} size={iconSize} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('tabs.profile'),
              tabBarAccessibilityLabel: t('tabs.profile'),
              tabBarButtonTestID: TID.Tab.Profile,
              tabBarIcon: ({ color }) => <IconSymbol name="person" color={color} size={iconSize} />,
            }}
          />
        </Tabs>

        {/* Pinned directly above the bar rather than inside it: expo-router owns
            the bar, and reimplementing it to host one strip is not worth it. */}
        <View
          pointerEvents="box-none"
          // zIndex is required: an absolutely-positioned sibling still paints
          // below the scene's own stacking context without it.
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: tabBarHeight + insets.bottom + tabBar.margin,
            zIndex: 10,
          }}>
          <MiniPlayer />
        </View>

        <DrawerButton />
      </View>
  );
}
