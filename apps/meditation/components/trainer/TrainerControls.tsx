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
  soundTestID: string;
  testID: string;
  onAction: () => void;
  onDurationChange: (minutes: BreathDurationMinutes) => void;
  onToggleSound: () => void;
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
  soundTestID,
  testID,
  onAction,
  onDurationChange,
  onToggleSound,
}: Props) {
  const colors = Themes[appearance];

  return (
    <View
      className="mx-gutter mb-2 overflow-hidden rounded-xl border border-hairline"
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
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 py-1">
                  {durations.map(({ label, value }) => (
                    <Chip
                      key={value}
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

          <View className="flex-row items-center gap-3">
            <Button
              testID={testID}
              label={actionLabel}
              onPress={onAction}
              className="flex-1"
            />
            <Pressable
              testID={soundTestID}
              accessibilityRole="switch"
              accessibilityLabel={soundLabel}
              accessibilityState={{ checked: soundEnabled }}
              hitSlop={8}
              onPress={onToggleSound}
              className="h-12 w-12 items-center justify-center rounded-full active:opacity-70">
              <IconSymbol
                name={soundEnabled ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
                color={colors.accentText}
                size={22}
              />
            </Pressable>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const toHex = (opacity: number): string =>
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
