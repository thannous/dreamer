import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalPaper } from '@/components/journal/JournalPaper';
import { RUNNING_HEAD_GAP, RUNNING_HEAD_HEIGHT } from '@/components/journal/JournalRunningHead';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';

/** Where the running head is printed, as on a page without a plate. */
const HEAD_TOP = 76 - RUNNING_HEAD_HEIGHT - RUNNING_HEAD_GAP;
/** How far above the dream's name the picture dissolves into the paper. */
const DISSOLVE = 180;
/** The name's height before it is measured. */
const TITLE_ESTIMATE = 180;

/**
 * A dream page that opens on its illustration, as a plate: the picture fills the screen
 * from its top edge, under the clock, the running head printed over a light veil of the
 * page's own ground, and it dissolves into the paper at the bottom, where the dream's name
 * is set on a near-opaque band of that ground. The dream page and its likeness in the
 * journal both lay it out here, so a page turned to takes over without anything moving.
 */
export function JournalCoverPlate({ height, titleHeight, picture, head, children, testID }: {
  height: number;
  /** The name's measured height, which the band beneath it follows. */
  titleHeight: number | null;
  /** The picture, filling the plate. */
  picture: ReactNode;
  head: ReactNode;
  /** The dream's name, date and details. */
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const palette = useMemo(() => getNoctaliaPalette(mode), [mode]);

  const headTop = insets.top + HEAD_TOP;
  const veil = headTop + RUNNING_HEAD_HEIGHT + 32;
  const titleTop = height - insets.bottom - (titleHeight ?? TITLE_ESTIMATE);
  const bandTop = Math.max(0, titleTop - 24 - DISSOLVE);
  const band = height - bandTop;

  return (
    <View testID={testID} className="relative overflow-hidden" style={{ height }}>
      {picture}
      <LinearGradient pointerEvents="none"
        colors={[palette.backgroundArtwork.scrim, palette.backgroundArtwork.scrim, palette.backgroundArtwork.transparent]}
        locations={[0, (headTop + RUNNING_HEAD_HEIGHT * 0.6) / veil, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: veil }} />
      <LinearGradient pointerEvents="none"
        colors={[palette.illustration.transparent, palette.backgroundArtwork.scrim, palette.illustration.scrim, palette.background]}
        locations={[0, (DISSOLVE * 0.55) / band, DISSOLVE / band, 1]}
        style={{ position: 'absolute', top: bandTop, left: 0, right: 0, height: band }} />
      {/* Printed on the page: the plate takes the paper's grain, so its foot is the page itself. */}
      <JournalPaper />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: headTop, left: 0, right: 0 }}>{head}</View>
      <View pointerEvents="box-none" className="px-4"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom }}>
        {children}
      </View>
    </View>
  );
}
