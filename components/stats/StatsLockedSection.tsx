import React, { memo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';

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

/**
 * `borderCurve` has no Tailwind token and `global.css` does not define one, so the iOS
 * continuous corner stays a style object rather than silently disappearing from the port.
 */
const CONTINUOUS_CORNERS: ViewStyle = { borderCurve: 'continuous' };

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
  /**
   * Surfaces and copy read `global.css` since the Uniwind port; this still carries the
   * icon colours, which are values passed to a native prop rather than styles.
   */
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
    // Mirrors `profilePlusPreview` in app/(tabs)/statistics.tsx — the visual reference the
    // contract names.
    <View
      className="border rounded-[18px] p-3.5 gap-3 border-line-strong bg-ink-soft"
      style={CONTINUOUS_CORNERS}
      testID={testID}
    >
      <View className="flex-row items-center gap-2">
        <IconSymbol name="lock.fill" size={16} color={noctalia.accent.text} />
        <Text className="flex-1 text-[15px] leading-5 font-sans-bold text-ivory">{countLabel}</Text>
      </View>
      <Text className="text-[13px] leading-[18px] font-sans text-ivory-muted">{bodyLabel}</Text>
      <View
        className="gap-[9px]"
        // The bars are unlabelled on purpose; a screen reader announcing N nameless
        // progress bars is noise. The count line above is the text alternative.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {previewRows.map((row) => (
          <View key={row.id} className="h-1.5 rounded-[3px] overflow-hidden bg-line">
            {/*
              Deliberately stays muted, unlike StatsRankedList's bars which were raised to
              full opacity. These widths are decorative — they encode nothing — so making
              them as crisp as the real ones would read as data the user does not actually
              have. The count above them is the honest number; these are texture.

              And they never animate: growing a bar explains where a value came from, and
              these values came from nowhere.
            */}
            <View
              className="h-1.5 rounded-[3px] opacity-60 bg-champagne"
              style={{
                width: `${Math.round(clampRatio(row.ratio) * 100)}%`,
                ...(row.color ? { backgroundColor: row.color } : null),
              }}
            />
          </View>
        ))}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        testID={ctaTestID}
        onPress={onPress}
        className="min-h-[42px] rounded-[15px] border px-3.5 flex-row items-center justify-center gap-2 self-start border-line-strong"
        style={CONTINUOUS_CORNERS}
      >
        <Text className="text-[14px] font-sans-bold text-center text-champagne-on">{ctaLabel}</Text>
        <IconSymbol name="arrow.right" size={15} color={noctalia.accent.text} />
      </PressableScale>
    </View>
  );
});

export type StatsNotEnoughDataProps = {
  /** Kept for the same reason as `StatsLockedSectionProps.noctalia`. */
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
      className="border rounded-[18px] p-4 gap-1 items-center border-line bg-ink-soft"
      style={CONTINUOUS_CORNERS}
      testID={testID}
    >
      <IconSymbol name="hourglass" size={18} color={noctalia.accent.text} />
      <Text className="text-[16px] leading-[21px] font-display-semibold text-center text-ivory">
        {title}
      </Text>
      <Text className="text-[13px] leading-[18px] font-sans text-center text-ivory-muted">
        {body}
      </Text>
    </View>
  );
});
