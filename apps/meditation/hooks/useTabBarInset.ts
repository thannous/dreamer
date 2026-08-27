import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompactTabBar, MiniPlayerHeight, TabBar } from '@/constants/layout';
import { usePlayer } from '@/context/PlayerContext';
import { useCompactLayout } from '@/hooks/useCompactLayout';

/** Extra space so the last row sits above the pill rather than behind it. */
const TabOverlapClearance = 28;

/** Room the tab titles need so the floating 48 dp drawer button cannot crop them. */
export const DrawerButtonClearance = 56;

/**
 * Reserve a second label line as Android accessibility text grows.
 *
 * React Navigation's default bottom-tab label is forced to one line. The tab
 * shell renders a wrapping label instead, so its floating pill has to grow in
 * step with the user's font scale rather than clipping the text vertically.
 */
export function accessibleTabBarHeight(baseHeight: number, fontScale: number): number {
  const extraScale = Math.max(0, fontScale - 1);
  return Math.ceil(baseHeight + extraScale * 44);
}

/**
 * Bottom padding a tab screen's scroll view needs so its last row clears the
 * floating chrome.
 *
 * The mini player is part of the count: it only exists while a session is
 * loaded, and when it appears it is what actually swallows the last row.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { session } = usePlayer();
  const compact = useCompactLayout();
  const tabBar = compact ? CompactTabBar : TabBar;
  const tabBarHeight = accessibleTabBarHeight(tabBar.height, fontScale);

  return (
    tabBarHeight +
    tabBar.margin * 2 +
    insets.bottom +
    TabOverlapClearance +
    (session ? MiniPlayerHeight : 0)
  );
}
