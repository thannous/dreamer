import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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
              {compact ? (
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="flex-row items-center gap-2 py-1 pr-4">
                  {durations.map(({ label, value }) => (
                    <Chip
                      key={value}
                      className="shrink-0"
                      label={label}
                      selected={durationMin === value}
                      onPress={() => onDurationChange(value)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {durations.map(({ label, value }) => (
                    <Chip
                      key={value}
                      label={label}
                      selected={durationMin === value}
                      onPress={() => onDurationChange(value)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <Button
            testID={testID}
            label={actionLabel}
            onPress={onAction}
          />

          {compact ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row items-center gap-2 py-1 pr-4">
              {assistance.map((item) => (
                <AssistanceSwitch key={item.testID} {...item} color={colors.accentText} />
              ))}
            </ScrollView>
          ) : (
            <View className="flex-row flex-wrap items-center gap-2">
              {assistance.map((item) => (
                <AssistanceSwitch key={item.testID} {...item} color={colors.accentText} />
              ))}
            </View>
          )}
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
  name,
  onToggle,
  testID,
}: {
  color: string;
  enabled: boolean;
  iconOff: React.ComponentProps<typeof IconSymbol>['name'];
  iconOn: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  name: string;
  onToggle: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled }}
      hitSlop={8}
      onPress={onToggle}
      className="min-h-12 shrink-0 flex-row items-center justify-center gap-2 rounded-full px-3 py-2 active:opacity-70">
      <IconSymbol name={enabled ? iconOn : iconOff} color={color} size={22} />
      <Text variant="caption">{name}</Text>
      {enabled ? <IconSymbol name="checkmark" color={color} size={16} /> : null}
    </Pressable>
  );
}

const toHex = (opacity: number): string =>
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
