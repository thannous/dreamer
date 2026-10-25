import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BAR_SHADOW, getBottomNavItems } from '@/components/navigation/NoctaliaBottomNav';
import { ActiveTabPill, TabBarGlass } from '@/components/navigation/TabBarGlass';
import { getSideColumnBarLayout } from '@/components/navigation/tabBarMetrics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import type { SideColumn, SideColumnTabBar as SideColumnTabBarState } from '@/context/SideColumnTabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

/**
 * The navigation in the iPhone Duo's side column, drawn by the root shell: the same five
 * destinations, glass and active lens as the floating bar, stood on end at the bottom of
 * the column, below the status bar.
 */
export function SideColumnTabBar({ column, bar, windowHeight, bottomInset }: {
  column: SideColumn;
  bar: SideColumnTabBarState;
  windowHeight: number;
  bottomInset: number;
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  // Capture doubles as the indicator of a dream analysis running in the background.
  const { activeAnalysis } = useAnalysisActivity();
  const layout = getSideColumnBarLayout({ columnWidth: column.width, height: windowHeight, bottomInset, fontScale });
  const items = getBottomNavItems(t, { compactLabels: layout.compactLabels, addDreamIcon: bar.captureIcon ?? 'pencil' });
  const labelWidth = layout.barWidth - layout.padding * 2 - 4;

  return (
    <View
      pointerEvents="box-none"
      testID={TID.Component.SideColumnTabBar}
      style={{ position: 'absolute', top: 0, bottom: 0, width: column.width, [column.side]: 0 }}
    >
      <View
        accessibilityRole="tablist"
        style={[
          BAR_SHADOW,
          {
            position: 'absolute',
            bottom: layout.bottom,
            left: layout.inset,
            width: layout.barWidth,
            height: layout.barHeight,
            padding: layout.padding,
            borderRadius: layout.borderRadius,
            borderColor: noctalia.nav.glass.rim,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <TabBarGlass borderRadius={layout.borderRadius} />
        {items.map((item) => {
          const isCenter = item.key === 'addDream';
          const isActive = item.key === bar.activeKey;
          return (
            <Pressable
              key={item.key}
              onPress={isActive ? (isCenter ? bar.onCapturePress : undefined) : () => bar.onSelect(item.key)}
              onPressIn={Platform.OS === 'ios' ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } : undefined}
              accessibilityRole="tab"
              aria-selected={isActive}
              aria-busy={isCenter ? Boolean(activeAnalysis) : undefined}
              accessibilityState={{ selected: isActive, busy: isCenter ? Boolean(activeAnalysis) : undefined }}
              accessibilityLabel={item.accessibilityLabel}
              accessibilityHint={isActive && isCenter && bar.onCapturePress ? bar.capturePressHint : undefined}
              testID={item.testID}
              style={{ height: layout.cellHeight }}
              className="w-full items-center justify-center gap-[2px] active:opacity-[0.72]"
            >
              {isActive ? (
                <ActiveTabPill style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: layout.pillRadius }} />
              ) : null}
              {isCenter ? (
                <View
                  className="items-center justify-center bg-champagne"
                  style={{ width: layout.captureSize, height: layout.captureSize, borderRadius: layout.captureSize / 2 }}
                >
                  {activeAnalysis ? (
                    <ActivityIndicator size="small" color={noctalia.action.primaryText} />
                  ) : (
                    <IconSymbol size={20} name={item.icon} color={noctalia.action.primaryText} />
                  )}
                </View>
              ) : (
                <View className="h-7 items-center justify-center">
                  <IconSymbol
                    size={24}
                    name={isActive && item.activeIcon ? item.activeIcon : item.icon}
                    color={isActive ? noctalia.nav.active : noctalia.nav.inactive}
                  />
                </View>
              )}
              <Text
                accessible={false}
                className={`text-center font-sans-medium ${isActive ? 'text-nav-active' : 'text-nav-inactive'}`}
                style={{
                  width: labelWidth,
                  height: layout.labelHeight,
                  fontSize: layout.labelFontSize,
                  lineHeight: layout.labelLineHeight,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                maxFontSizeMultiplier={BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER}
                minimumFontScale={0.75}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
