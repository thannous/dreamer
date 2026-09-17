import {
  BlurMask,
  Circle,
  Group,
  Oval,
  RadialGradient,
} from '@shopify/react-native-skia';
import React from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

type GroundedOrbProps = {
  width: number;
  height: number;
  glowColor: string;
  lightColor: string;
  groundColor: string;
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

/** A luminous volume with a contact shadow, so it belongs to the scene. */
export function GroundedOrb({
  width,
  height,
  glowColor,
  lightColor,
  groundColor,
  breath,
  still,
}: GroundedOrbProps) {
  const radius = Math.min(width * 0.17, 72);
  const centre = { x: width * 0.5, y: height * 0.49 };
  const orbTransform = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return [
      { translateY: (0.5 - phase) * 5 },
      { scale: 0.96 + phase * 0.055 },
    ];
  }, [still]);
  const orbOpacity = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return 0.74 + phase * 0.2;
  }, [still]);
  const groundOpacity = useDerivedValue(() => {
    const phase = still ? 0.5 : breath.get();
    return 0.46 - phase * 0.1;
  }, [still]);

  return (
    <Group>
      <Group opacity={groundOpacity}>
        <Oval
          x={centre.x - radius * 1.16}
          y={centre.y + radius * 0.78}
          width={radius * 2.32}
          height={radius * 0.4}>
          <RadialGradient
            c={{ x: centre.x, y: centre.y + radius * 0.98 }}
            r={radius * 1.14}
            colors={[
              withAlpha(glowColor, 0.48),
              withAlpha(groundColor, 0.24),
              withAlpha(groundColor, 0),
            ]}
            positions={[0, 0.48, 1]}
          />
          <BlurMask blur={14} style="normal" />
        </Oval>
      </Group>

      <Group
        opacity={orbOpacity}
        origin={centre}
        transform={orbTransform}>
        <Circle c={centre} r={radius * 1.16}>
          <RadialGradient
            c={centre}
            r={radius * 1.16}
            colors={[
              withAlpha(lightColor, 0.44),
              withAlpha(glowColor, 0.26),
              withAlpha(glowColor, 0),
            ]}
            positions={[0, 0.46, 1]}
          />
          <BlurMask blur={18} style="normal" />
        </Circle>

        <Circle c={centre} r={radius}>
          <RadialGradient
            c={{ x: centre.x - radius * 0.28, y: centre.y - radius * 0.34 }}
            r={radius * 1.28}
            colors={[
              withAlpha(lightColor, 0.92),
              withAlpha(glowColor, 0.66),
              withAlpha(groundColor, 0.58),
            ]}
            positions={[0, 0.48, 1]}
          />
        </Circle>

        <Circle
          c={centre}
          r={radius * 0.94}
          color={withAlpha(lightColor, 0.46)}
          style="stroke"
          strokeWidth={1.1}
        />
      </Group>
    </Group>
  );
}
