import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type {
  DreamApproximatePeriod,
  DreamStrongestFragment,
  RememberedDreamKind,
} from '@/lib/types';

type RememberedOption<T extends string> = {
  value: T;
  labelKey: string;
};

const KIND_OPTIONS: RememberedOption<RememberedDreamKind>[] = [
  { value: 'old', labelKey: 'recording.remembered_profile.kind.old' },
  { value: 'recurring', labelKey: 'recording.remembered_profile.kind.recurring' },
  { value: 'nightmare', labelKey: 'recording.remembered_profile.kind.nightmare' },
  { value: 'lucid', labelKey: 'recording.remembered_profile.kind.lucid' },
  { value: 'meaningful', labelKey: 'recording.remembered_profile.kind.meaningful' },
  { value: 'person', labelKey: 'recording.remembered_profile.kind.person' },
];

const PERIOD_OPTIONS: RememberedOption<DreamApproximatePeriod>[] = [
  { value: 'recent', labelKey: 'recording.remembered_profile.period.recent' },
  { value: 'months_ago', labelKey: 'recording.remembered_profile.period.months_ago' },
  { value: 'years_ago', labelKey: 'recording.remembered_profile.period.years_ago' },
  { value: 'childhood', labelKey: 'recording.remembered_profile.period.childhood' },
  { value: 'unknown', labelKey: 'recording.remembered_profile.period.unknown' },
];

const FRAGMENT_OPTIONS: RememberedOption<DreamStrongestFragment>[] = [
  { value: 'place', labelKey: 'recording.remembered_profile.fragment.place' },
  { value: 'person', labelKey: 'recording.remembered_profile.fragment.person' },
  { value: 'sensation', labelKey: 'recording.remembered_profile.fragment.sensation' },
  { value: 'image', labelKey: 'recording.remembered_profile.fragment.image' },
  { value: 'fear', labelKey: 'recording.remembered_profile.fragment.fear' },
  { value: 'color', labelKey: 'recording.remembered_profile.fragment.color' },
];

type RememberedDreamProfileChipsProps = {
  rememberedKind?: RememberedDreamKind;
  approximatePeriod?: DreamApproximatePeriod;
  strongestFragment?: DreamStrongestFragment;
  disabled?: boolean;
  onRememberedKindChange: (value: RememberedDreamKind) => void;
  onApproximatePeriodChange: (value: DreamApproximatePeriod) => void;
  onStrongestFragmentChange: (value: DreamStrongestFragment) => void;
};

export function RememberedDreamProfileChips({
  rememberedKind,
  approximatePeriod,
  strongestFragment,
  disabled = false,
  onRememberedKindChange,
  onApproximatePeriodChange,
  onStrongestFragmentChange,
}: RememberedDreamProfileChipsProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const renderChip = <T extends string>({
    option,
    selected,
    onPress,
    testID,
  }: {
    option: RememberedOption<T>;
    selected: boolean;
    onPress: () => void;
    testID: string;
  }) => (
    <Pressable
      key={option.value}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? noctalia.action.primary : noctalia.surface.soft,
          borderColor: selected ? noctalia.action.primaryBorder : noctalia.surface.border,
          opacity: disabled ? 0.62 : pressed ? 0.78 : 1,
        },
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? noctalia.action.primaryText : noctalia.text.secondary },
        ]}
      >
        {t(option.labelKey)}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
      ]}
      testID={TID.Component.RememberedDreamMetadata}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        accessibilityHint={t(
          expanded
            ? 'recording.remembered_profile.collapse_hint'
            : 'recording.remembered_profile.expand_hint'
        )}
        disabled={disabled}
        onPress={() => setExpanded((current) => !current)}
        style={styles.toggle}
        testID={TID.Button.RememberedDreamMetadataToggle}
      >
        <View style={styles.toggleCopy}>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>
            {t('recording.remembered_profile.accordion_title')}
          </Text>
          <Text style={[styles.toggleDescription, { color: noctalia.text.secondary }]}>
            {t('recording.remembered_profile.title')}
          </Text>
        </View>
        <IconSymbol
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={20}
          color={noctalia.text.secondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.expandedContent} testID={TID.Component.RememberedDreamProfileChips}>
          <ChipGroup label={t('recording.remembered_profile.kind_label')}>
            {KIND_OPTIONS.map((option) =>
              renderChip({
                option,
                selected: rememberedKind === option.value,
                onPress: () => onRememberedKindChange(option.value),
                testID: TID.Button.RememberedDreamKind(option.value),
              })
            )}
          </ChipGroup>

          <ChipGroup label={t('recording.remembered_profile.period_label')}>
            {PERIOD_OPTIONS.map((option) =>
              renderChip({
                option,
                selected: approximatePeriod === option.value,
                onPress: () => onApproximatePeriodChange(option.value),
                testID: TID.Button.RememberedDreamPeriod(option.value),
              })
            )}
          </ChipGroup>

          <ChipGroup label={t('recording.remembered_profile.fragment_label')}>
            {FRAGMENT_OPTIONS.map((option) =>
              renderChip({
                option,
                selected: strongestFragment === option.value,
                onPress: () => onStrongestFragmentChange(option.value),
                testID: TID.Button.RememberedDreamFragment(option.value),
              })
            )}
          </ChipGroup>
        </View>
      ) : null}
    </View>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: noctalia.text.secondary }]}>{label}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 14,
  },
  toggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  toggleDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  expandedContent: {
    gap: 14,
    paddingTop: 14,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    textAlign: 'center',
  },
});
