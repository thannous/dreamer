import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { getJournalSpread, type JournalSpread } from '@/constants/layout';
import { useContentWindow, useSideGutters } from '@/context/ContentWindowContext';

/**
 * The dream's two facing pages in the window it has now, or null for its single page.
 * Read at every render: folding, unfolding or rotating the device changes it under the
 * reader, and the page, its likenesses and its turns all follow the same answer.
 */
export function useJournalSpread(): JournalSpread | null {
  const { width, height } = useContentWindow();
  const { width: windowWidth } = useWindowDimensions();
  const { left } = useSideGutters();
  return useMemo(
    () => getJournalSpread({ width, height, windowWidth, leftInset: left, web: Platform.OS === 'web' }),
    [height, left, width, windowWidth],
  );
}
