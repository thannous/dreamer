import { BlurMask, Group, Oval, RadialGradient } from '@shopify/react-native-skia';
import React from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

type FogFieldProps = {
  width: number;
  height: number;
  color: string;
  breath: SharedValue<number>;
  still: boolean;
};

function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'transparent';

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Three broad, low-alpha fields that read as mist rather than discrete blobs.
 * Their transforms consume the app-wide breath directly on the UI thread.
 */
export function FogField({ width, height, color, breath, still }: FogFieldProps) {
  const leftDrift = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return [
      { translateX: (phase - 0.5) * 24 },
      { translateY: (phase - 0.5) * -8 },
    ];
  }, [still]);
  const rightDrift = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return [
      { translateX: (0.5 - phase) * 30 },
      { translateY: (phase - 0.5) * 10 },
    ];
  }, [still]);
  const groundDrift = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return [
      { translateX: (phase - 0.5) * 14 },
      { translateY: (0.5 - phase) * 5 },
    ];
  }, [still]);
  const mistOpacity = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return 0.62 + phase * 0.18;
  }, [still]);

  const clear = withAlpha(color, 0);
  const faint = withAlpha(color, 0.1);
  const visible = withAlpha(color, 0.28);

  return (
    <Group opacity={mistOpacity}>
      <Group transform={leftDrift}>
        <Oval
          x={width * -0.32}
          y={height * 0.24}
          width={width * 1.04}
          height={height * 0.24}>
          <RadialGradient
            c={{ x: width * 0.15, y: height * 0.36 }}
            r={width * 0.52}
            colors={[visible, faint, clear]}
            positions={[0, 0.52, 1]}
          />
          <BlurMask blur={28} style="normal" />
        </Oval>
      </Group>

      <Group transform={rightDrift}>
        <Oval
          x={width * 0.28}
          y={height * 0.39}
          width={width * 1.04}
          height={height * 0.22}>
          <RadialGradient
            c={{ x: width * 0.8, y: height * 0.49 }}
            r={width * 0.5}
            colors={[visible, faint, clear]}
            positions={[0, 0.58, 1]}
          />
          <BlurMask blur={30} style="normal" />
        </Oval>
      </Group>

      <Group transform={groundDrift}>
        <Oval
          x={width * -0.18}
          y={height * 0.58}
          width={width * 1.36}
          height={height * 0.16}>
          <RadialGradient
            c={{ x: width * 0.5, y: height * 0.65 }}
            r={width * 0.62}
            colors={[withAlpha(color, 0.22), faint, clear]}
            positions={[0, 0.62, 1]}
          />
          <BlurMask blur={24} style="normal" />
        </Oval>
      </Group>
    </Group>
  );
}
