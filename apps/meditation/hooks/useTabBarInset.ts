import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayerHeight, TabBar } from '@/constants/layout';
import { usePlayer } from '@/context/PlayerContext';

/**
 * Bottom padding a tab screen's scroll view needs so its last row clears the
 * floating chrome.
 *
 * The mini player is part of the count: it only exists while a session is
 * loaded, and when it appears it is what actually swallows the last row.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const { session } = usePlayer();

  return (
    TabBar.height + TabBar.margin * 2 + insets.bottom + (session ? MiniPlayerHeight : 0)
  );
}
