import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';

/**
 * The ranked list shipped for "Top themes": rank chip, label, count, proportional bar.
 *
 * Extracted from app/(tabs)/statistics.tsx so "Émotions dominantes" (S2) REUSES the visual
 * instead of forking it, as the phase 1 contract binds. The per-row progressbar role and its
 * accessibilityValue are the part a copy would have silently dropped; sharing the component
 * makes that structurally impossible.
 *
 * The bar is relative to `maxCount` — the top row is always 100% — NOT a share of the
 * journal. That is what Top themes does today and both callers must read the same way.
 */

export type StatsRankedRow = {
  /** React key; also the identity a test asserts on. Never rendered. */
  id: string;
  /** Already translated. */
  label: string;
  /** Already translated, e.g. "3 dreams". Also used as accessibilityValue.text. */
  countLabel: string;
  /** Raw count. Drives the bar width and accessibilityValue.now. */
  count: number;
};

export type StatsRankedListProps = {
  noctalia: NoctaliaDesignTokens;
  /** Already ranked by the caller. Rendered in order, unsliced. */
  rows: StatsRankedRow[];
  /** Bar denominator and accessibilityValue.max. Callers pass Math.max(...counts, 1). */
  maxCount: number;
  testID: string;
};

export const StatsRankedList = memo(function StatsRankedList({
  noctalia,
  rows,
  maxCount,
  testID,
}: StatsRankedListProps) {
  return (
    <View style={styles.container} testID={testID}>
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        const barWidth = Math.round((row.count / maxCount) * 100);
        return (
          <View key={row.id}>
            <View
              style={[
                styles.item,
                !isLast && { borderBottomWidth: 1, borderBottomColor: noctalia.surface.border },
              ]}
            >
              <View style={[styles.rank, { backgroundColor: noctalia.surface.soft }]}>
                <Text style={[styles.rankText, { color: noctalia.accent.text }]}>{index + 1}</Text>
              </View>
              <View style={styles.content}>
                <Text style={[styles.text, { color: noctalia.text.primary }]}>{row.label}</Text>
                <Text style={[styles.count, { color: noctalia.text.secondary }]}>
                  {row.countLabel}
                </Text>
                <View
                  style={[styles.barTrack, { backgroundColor: noctalia.surface.border }]}
                  accessibilityRole="progressbar"
                  accessibilityLabel={row.label}
                  accessibilityValue={{
                    min: 0,
                    max: maxCount,
                    now: row.count,
                    text: row.countLabel,
                  }}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: noctalia.accent.base,
                        width: `${barWidth}%` as any,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
});

// Moved verbatim from app/(tabs)/statistics.tsx (the `// Themes` block).
const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: ThemeLayout.spacing.md,
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontFamily: Fonts.fraunces.bold,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: 2,
  },
  count: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: 6,
  },
  // The track carries a background so the bar reads as a PROPORTION rather than a bare
  // length: without it only the filled part is drawn, and "3 dreams" and "1 dream" look
  // like two unrelated dashes instead of a full bar next to a third of one.
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  // Full opacity. At 0.6 over the dark card the accent washed out to the edge of
  // legibility — verified on device — and these bars carry real data, so they have to
  // survive a bright screen.
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});
