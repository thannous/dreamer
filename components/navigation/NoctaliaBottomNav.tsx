import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  DESKTOP_BREAKPOINT,
  getBottomNavigationLayout,
  getTabBarHorizontalLayout,
} from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];
type BottomNavKey = 'home' | 'journal' | 'addDream' | 'stats';

type BottomNavItem = {
  key: BottomNavKey;
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  href: string;
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

const ADD_SHADOW: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.24,
  shadowRadius: 14,
  elevation: 8,
};

/**
 * The capture button lifts out of the bar. Kept as a transform on the style prop rather
 * than a `-translate-y-*` class: Tailwind v4 emits the `translate` shorthand through CSS
 * variables, and the exact RN transform is what the current pixel output depends on.
 */
const ADD_LIFT = {
  default: { transform: [{ translateY: -8 }] } satisfies ViewStyle,
  compact: { transform: [{ translateY: -4 }] } satisfies ViewStyle,
  narrow: { transform: [{ translateY: -6 }] } satisfies ViewStyle,
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
  const addTextColor = noctalia.action.primaryText;
  const horizontalLayout = getTabBarHorizontalLayout(width);

  const barClassName = [
    'absolute flex-row border border-line-nav bg-ink-nav',
    navigationLayout.compact ? 'rounded-[28px] py-1' : 'rounded-[36px] py-[7px]',
    navigationLayout.narrow ? 'px-1' : 'px-2',
  ].join(' ');

  const addItemClassName = [
    'items-center justify-center border-2 border-champagne-soft bg-champagne',
    navigationLayout.compact
      ? 'gap-px rounded-[22px]'
      : navigationLayout.narrow
        ? 'gap-[3px] rounded-[24px]'
        : 'gap-1 rounded-[27px]',
  ].join(' ');
  const labelLines = navigationLayout.stackedLabels ? 2 : 1;

  const addLift = navigationLayout.compact
    ? ADD_LIFT.compact
    : navigationLayout.narrow
      ? ADD_LIFT.narrow
      : ADD_LIFT.default;

  const labelSizeClassName = navigationLayout.narrow
    ? 'text-[11px] px-px'
    : navigationLayout.compact
      ? 'text-[11px]'
      : 'text-[12px]';

  const items: BottomNavItem[] = [
    {
      key: 'home',
      label: t('nav.home'),
      accessibilityLabel: t('nav.home'),
      icon: 'house',
      href: '/',
      testID: TID.Tab.Home,
    },
    {
      key: 'journal',
      label: t('nav.journal'),
      accessibilityLabel: t('nav.journal'),
      icon: 'book',
      href: '/journal',
      testID: TID.Tab.Journal,
    },
    {
      key: 'addDream',
      label: t('nav.capture_dream'),
      accessibilityLabel: t('nav.capture_dream_accessibility'),
      icon: addDreamIcon,
      href: '/recording',
      testID: TID.Tab.AddDream,
    },
    {
      key: 'stats',
      label: t('nav.stats'),
      accessibilityLabel: t('nav.stats'),
      icon: 'chart.bar',
      href: '/statistics',
      testID: TID.Tab.Stats,
    },
  ];

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-[45]">
      <View
        onLayout={onBarLayout}
        className={barClassName}
        style={[
          BAR_SHADOW,
          {
            bottom: floatingBottomInset,
            height: navigationLayout.barHeight,
            ...horizontalLayout,
          },
        ]}
      >
        {items.map((item) => {
          const isCenter = item.key === 'addDream';
          const isActive = item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              onPress={isActive ? undefined : () => router.push(item.href as any)}
              accessibilityRole="tab"
              accessibilityState={{
                selected: isActive,
                busy: isCenter ? Boolean(activeAnalysis) : undefined,
              }}
              accessibilityLabel={item.accessibilityLabel}
              testID={item.testID}
              className="h-full min-w-0 flex-1 items-center justify-center active:opacity-[0.72]"
            >
              {isCenter ? (
                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  className={addItemClassName}
                  style={[
                    ADD_SHADOW,
                    addLift,
                    {
                      width: navigationLayout.centerActionWidth,
                      height: navigationLayout.centerActionHeight,
                    },
                  ]}
                >
                  {activeAnalysis ? (
                    <ActivityIndicator size="small" color={addTextColor} />
                  ) : (
                    <IconSymbol
                      size={24}
                      name={item.icon}
                      color={addTextColor}
                    />
                  )}
                  <Text
                    accessible={false}
                    className={`font-sans-bold w-full min-w-0 shrink text-center text-on-champagne ${
                      navigationLayout.narrow ? 'text-[11px] px-px' : 'text-[12px]'
                    }`}
                    numberOfLines={labelLines}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit={!navigationLayout.stackedLabels}
                    minimumFontScale={navigationLayout.narrow ? 0.75 : 0.85}
                  >
                    {item.label}
                  </Text>
                </View>
              ) : (
                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  className={`w-full min-w-0 flex-1 items-center justify-center ${
                    navigationLayout.compact ? 'gap-px' : 'gap-[5px]'
                  }`}
                >
                  <IconSymbol
                    size={24}
                    name={item.icon}
                    color={isActive ? navActiveColor : navInactiveColor}
                  />
                  <Text
                    accessible={false}
                    className={`font-sans-medium w-full min-w-0 shrink text-center ${labelSizeClassName} ${
                      isActive ? 'text-nav-active' : 'text-nav-inactive'
                    }`}
                    numberOfLines={labelLines}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit={!navigationLayout.stackedLabels}
                    minimumFontScale={navigationLayout.narrow ? 0.75 : 0.8}
                  >
                    {item.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
