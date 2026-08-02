import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';

/**
 * The paid gate the audit asked for (§7.1): show the count, lock the detail.
 *
 * The four "Insight Plus" cartouches it replaces had zero information scent and hid two
 * values that were free two sections below. Here the headline is a real, computed number
 * that can only come from the paid computation, and the bars below it carry no names and
 * no real proportions — they say how much there is, never what it is.
 *
 * The prop surface is deliberately minimal and shared by both callers (S2 emotions and S3
 * themes over time): no badge, no preview hint. Two locked cards on the same screen cannot
 * look different if there is nothing to make them differ.
 */

export type StatsLockedPreviewRow = {
  id: string;
  /**
   * 0..1, DECORATIVE ONLY. Callers pass a rank-derived ramp, never a real ratio: a real
   * proportion would leak the answer the section is supposed to be gating.
   */
  ratio: number;
  color?: string;
};

export type StatsLockedSectionProps = {
  noctalia: NoctaliaDesignTokens;
  /** Already translated. The honest, computed count line. */
  countLabel: string;
  /** Already translated. One line on what unlocking reveals. */
  bodyLabel: string;
  /** Already translated. */
  ctaLabel: string;
  previewRows: StatsLockedPreviewRow[];
  onPress: () => void;
  testID: string;
  ctaTestID: string;
};

const clampRatio = (value: number) => Math.min(Math.max(value, 0.12), 1);

export const StatsLockedSection = memo(function StatsLockedSection({
  noctalia,
  countLabel,
  bodyLabel,
  ctaLabel,
  previewRows,
  onPress,
  testID,
  ctaTestID,
}: StatsLockedSectionProps) {
  return (
    <View
      style={[
        styles.card,
        { borderColor: noctalia.surface.borderStrong, backgroundColor: noctalia.surface.soft },
      ]}
      testID={testID}
    >
      <View style={styles.header}>
        <IconSymbol name="lock.fill" size={16} color={noctalia.accent.base} />
        <Text style={[styles.count, { color: noctalia.text.primary }]}>{countLabel}</Text>
      </View>
      <Text style={[styles.body, { color: noctalia.text.secondary }]}>{bodyLabel}</Text>
      <View
        style={styles.preview}
        // The bars are unlabelled on purpose; a screen reader announcing N nameless
        // progress bars is noise. The count line above is the text alternative.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {previewRows.map((row) => (
          <View
            key={row.id}
            style={[styles.previewTrack, { backgroundColor: noctalia.surface.border }]}
          >
            <View
              style={[
                styles.previewFill,
                {
                  width: `${Math.round(clampRatio(row.ratio) * 100)}%`,
                  backgroundColor: row.color ?? noctalia.accent.base,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        testID={ctaTestID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cta,
          { borderColor: noctalia.surface.borderStrong },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.ctaText, { color: noctalia.accent.base }]}>{ctaLabel}</Text>
        <IconSymbol name="arrow.right" size={15} color={noctalia.accent.base} />
      </Pressable>
    </View>
  );
});

export type StatsNotEnoughDataProps = {
  noctalia: NoctaliaDesignTokens;
  /** Already translated. */
  title: string;
  /** Already translated. Names how many more dreams / days are needed. */
  body: string;
  testID: string;
};

/** Shared "not enough yet" card, so S2 and S3 cannot drift into two different shapes. */
export const StatsNotEnoughData = memo(function StatsNotEnoughData({
  noctalia,
  title,
  body,
  testID,
}: StatsNotEnoughDataProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={[
        styles.notEnough,
        { borderColor: noctalia.surface.border, backgroundColor: noctalia.surface.soft },
      ]}
      testID={testID}
    >
      <IconSymbol name="hourglass" size={18} color={noctalia.accent.base} />
      <Text style={[styles.notEnoughTitle, { color: noctalia.text.primary }]}>{title}</Text>
      <Text style={[styles.notEnoughBody, { color: noctalia.text.secondary }]}>{body}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // Mirrors `profilePlusPreview` in app/(tabs)/statistics.tsx — the visual reference the
  // contract names.
  card: {
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  preview: {
    gap: 9,
  },
  previewTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  // Deliberately stays muted, unlike StatsRankedList's bars which were raised to full
  // opacity. These widths are decorative — they encode nothing — so making them as crisp
  // as the real ones would read as data the user does not actually have. The count above
  // them is the honest number; these are texture.
  previewFill: {
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
  cta: {
    minHeight: 42,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  notEnough: {
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.xs,
    alignItems: 'center',
  },
  notEnoughTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: Fonts.fraunces.semiBold,
    textAlign: 'center',
  },
  notEnoughBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
});
