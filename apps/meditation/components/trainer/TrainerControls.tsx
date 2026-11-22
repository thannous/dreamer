import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, View } from 'react-native';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { Button, Chip, IconSymbol, Text } from '@/components/ui';
import { GlassOpacity, Radius, Themes, type ThemeMode } from '@/constants/theme';
import type { BreathDurationMinutes } from '@/content/breathing';

type DurationOption = {
  label: string;
  value: BreathDurationMinutes;
};

type Props = {
  actionLabel: string;
  /** While the breath runs, « Pause » steps back to an outline so the ring
   * keeps the eye; the filled button returns whenever there is a decision. */
  actionQuiet?: boolean;
  appearance: ThemeMode;
  compact: boolean;
  durationLabel: string;
  durationMin: BreathDurationMinutes;
  durations: readonly DurationOption[];
  showDurations: boolean;
  soundEnabled: boolean;
  soundLabel: string;
  soundName: string;
  soundTestID: string;
  testID: string;
  onAction: () => void;
  onDurationChange: (minutes: BreathDurationMinutes) => void;
  onToggleSound: () => void;
  hapticEnabled?: boolean;
  hapticLabel?: string;
  hapticName?: string;
  hapticTestID?: string;
  onToggleHaptic?: () => void;
  voiceEnabled?: boolean;
  voiceLabel?: string;
  voiceName?: string;
  voiceTestID?: string;
  onToggleVoice?: () => void;
};

/** The trainer's sole glass surface: setup and transport share one shelf. */
export function TrainerControls({
  actionLabel,
  actionQuiet = false,
  appearance,
  compact,
  durationLabel,
  durationMin,
  durations,
  showDurations,
  soundEnabled,
  soundLabel,
  soundName,
  soundTestID,
  testID,
  onAction,
  onDurationChange,
  onToggleSound,
  hapticEnabled = false,
  hapticLabel,
  hapticName,
  hapticTestID,
  onToggleHaptic,
  voiceEnabled = false,
  voiceLabel,
  voiceName,
  voiceTestID,
  onToggleVoice,
}: Props) {
  const colors = Themes[appearance];
  const assistance = [
    {
      testID: soundTestID,
      label: soundLabel,
      name: soundName,
      enabled: soundEnabled,
      iconOn: 'speaker.wave.2.fill' as const,
      iconOff: 'speaker.slash.fill' as const,
      onToggle: onToggleSound,
    },
    voiceTestID && voiceLabel && voiceName && onToggleVoice
      ? {
          testID: voiceTestID,
          label: voiceLabel,
          name: voiceName,
          enabled: voiceEnabled,
          iconOn: 'waveform' as const,
          iconOff: 'waveform' as const,
          onToggle: onToggleVoice,
        }
      : null,
    hapticTestID && hapticLabel && hapticName && onToggleHaptic
      ? {
          testID: hapticTestID,
          label: hapticLabel,
          name: hapticName,
          enabled: hapticEnabled,
          iconOn: 'water.waves' as const,
          iconOff: 'water.waves' as const,
          onToggle: onToggleHaptic,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <View
      className={`mx-gutter mb-2 overflow-hidden rounded-xl border border-hairline ${compact ? 'shrink' : ''}`}
      style={{ borderRadius: Radius.xl }}>
      <BlurView
        intensity={appearance === 'dark' ? 24 : 16}
        tint={appearance}
        style={{
          backgroundColor: colors.glassTint + toHex(GlassOpacity[appearance]),
        }}>
        <GrainOverlay opacity={appearance === 'dark' ? 0.035 : 0.022} />
        <View className={`gap-4 ${compact ? 'p-4' : 'p-gutter'}`} style={{ zIndex: 1 }}>
          {showDurations ? (
            <View className="gap-3">
              <Text variant="overline">{durationLabel}</Text>
              <View className="flex-row flex-wrap items-center gap-2">
                {durations.map(({ label, value }) => (
                  <Chip
                    key={value}
                    className="shrink-0"
                    label={label}
                    selected={durationMin === value}
                    onPress={() => onDurationChange(value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Button
            testID={testID}
            label={actionLabel}
            variant={actionQuiet ? 'secondary' : 'primary'}
            onPress={onAction}
          />

          <View className="flex-row flex-wrap items-center gap-2">
            {assistance.map((item) => (
              <AssistanceSwitch
                key={item.testID}
                {...item}
                color={colors.accentText}
                mutedColor={colors.textSecondary}
                onColor={colors.textOnAccent}
              />
            ))}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

function AssistanceSwitch({
  color,
  enabled,
  iconOff,
  iconOn,
  label,
  mutedColor,
  name,
  onColor,
  onToggle,
  testID,
}: {
  color: string;
  enabled: boolean;
  iconOff: React.ComponentProps<typeof IconSymbol>['name'];
  iconOn: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  mutedColor: string;
  name: string;
  onColor: string;
  onToggle: () => void;
  testID: string;
}) {
  // Both states are drawn: an outlined pill with a check when on, a quieter
  // pill with an empty mark when off. A lone trailing check left the « off »
  // options looking like plain labels.
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled }}
      hitSlop={8}
      onPress={onToggle}
      className={`min-h-12 shrink-0 flex-row items-center justify-center gap-2 rounded-full border px-3 py-2 active:opacity-70 ${
        enabled ? 'border-champagne-text' : 'border-hairline'
      }`}>
      <IconSymbol name={enabled ? iconOn : iconOff} color={enabled ? color : mutedColor} size={20} />
      <Text variant="caption" tone={enabled ? 'default' : 'muted'}>
        {name}
      </Text>
      <View
        testID={`${testID}.state`}
        className={`h-4 w-4 items-center justify-center rounded-full border ${
          enabled ? 'border-champagne bg-champagne' : 'border-ivory-muted'
        }`}>
        {enabled ? <IconSymbol name="checkmark" color={onColor} size={11} /> : null}
      </View>
    </Pressable>
  );
}

const toHex = (opacity: number): string =>
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
