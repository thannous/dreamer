import React from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { BreathGauge } from '@/components/breathe/BreathGauge';
import { BreathRing } from '@/components/breathe/BreathRing';
import { Text } from '@/components/ui';
import type { WorldMotion } from '@/constants/worlds';
import type { AccentPair } from '@/lib/types';

import { TrainerProgress } from './TrainerProgress';
import { WorldTrainerSignature } from './WorldTrainerSignature';

type Props = {
  accent: AccentPair;
  compact: boolean;
  cycleCurrent: number;
  cycleLabel: string;
  cycleTotal: number;
  finished: boolean;
  nextLabel: string | null;
  phaseCue: string | null;
  phaseLabel: string;
  phaseProgress: number;
  phaseRemainingSec: number;
  ready?: boolean;
  reducedMotion: boolean;
  remainingLabel: string;
  ringSize: number;
  scale: SharedValue<number>;
  phaseTestID: string;
  worldMotion: WorldMotion;
};

/**
 * The trainer's single focal point. The engine-owned ring remains the only
 * moving geometry; copy, countdown and progress merely explain its state.
 */
export function TrainerFocus({
  accent,
  compact,
  cycleCurrent,
  cycleLabel,
  cycleTotal,
  finished,
  nextLabel,
  phaseCue,
  phaseLabel,
  phaseProgress,
  phaseRemainingSec,
  ready = false,
  reducedMotion,
  remainingLabel,
  ringSize,
  scale,
  phaseTestID,
  worldMotion,
}: Props) {
  return (
    <View
      className={`w-full items-center ${compact ? 'shrink gap-2 pt-1' : 'flex-1 justify-center gap-5'}`}>
      <View className="w-full items-center gap-2 px-1">
        <Text
          testID={phaseTestID}
          variant={compact ? 'h2' : 'display'}
          className="text-center"
          accessibilityRole="header">
          {phaseLabel}
        </Text>
        {phaseCue && !compact ? (
          <Text variant="bodySm" tone="muted" className="text-center">
            {phaseCue}
          </Text>
        ) : null}
      </View>

      {ready && compact ? null : reducedMotion || compact ? (
        <BreathGauge
          progress={phaseProgress}
          remainingSec={phaseRemainingSec}
          compact={compact}
        />
      ) : (
        <View
          className="items-center justify-center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <WorldTrainerSignature motion={worldMotion} size={ringSize}>
            <BreathRing scale={scale} accent={accent} size={ringSize} />
          </WorldTrainerSignature>
          <View className="absolute inset-0 items-center justify-center">
            <Text variant="h1">{finished || ready ? '·' : phaseRemainingSec}</Text>
          </View>
        </View>
      )}

      <View className={`w-full items-center ${compact ? 'gap-2 px-1' : 'gap-3 px-7'}`}>
        {nextLabel && !compact ? (
          <Text variant="caption" tone="default" className="text-center">
            {nextLabel}
          </Text>
        ) : null}
        <Text variant="h3" className="text-center">
          {remainingLabel}
        </Text>
        {ready ? null : (
          <TrainerProgress
            compact={compact}
            current={cycleCurrent}
            label={cycleLabel}
            ready={ready}
            total={cycleTotal}
          />
        )}
      </View>
    </View>
  );
}
