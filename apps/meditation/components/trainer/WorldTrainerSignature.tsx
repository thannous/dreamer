import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { WorldMotion } from '@/constants/worlds';
import { useTheme } from '@/context/ThemeContext';

type Props = React.PropsWithChildren<{
  motion: WorldMotion;
  size: number;
}>;

/**
 * A quiet, static physical grammar around the shared breathing ring.
 *
 * The ring remains the trainer's only moving geometry. These marks make the
 * selected world recognisable without adding another loop, instruction, or
 * accessibility stop.
 */
export function WorldTrainerSignature({ motion, size, children }: Props) {
  const { colors } = useTheme();
  const frameSize = size + 48;
  const line = colors.accentLight;
  const subtle = colors.divider;

  return (
    <View style={{ width: frameSize, height: frameSize }} className="items-center justify-center">
      <View
        testID={`trainer.signature.${motion}`}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}>
        {motion === 'orbit' ? (
          <>
            <View
              style={[
                styles.orbit,
                {
                  borderColor: subtle,
                  borderRadius: frameSize / 2,
                  inset: 5,
                  transform: [{ rotate: '-12deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: line, right: 25, top: 25 },
              ]}
            />
          </>
        ) : null}

        {motion === 'rise' ? (
          <>
            <View
              style={[
                styles.horizon,
                { backgroundColor: subtle, bottom: 18, left: 18, right: 18 },
              ]}
            />
            <View
              style={[
                styles.vertical,
                { backgroundColor: line, bottom: 18, height: 30, left: frameSize / 2 },
              ]}
            />
          </>
        ) : null}

        {motion === 'canopy' ? (
          <>
            {[0.28, 0.72].map((ratio) => (
              <React.Fragment key={ratio}>
                <View
                  style={[
                    styles.canopyMark,
                    {
                      backgroundColor: ratio < 0.5 ? line : subtle,
                      left: 10,
                      top: frameSize * ratio,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.canopyMark,
                    {
                      backgroundColor: ratio > 0.5 ? line : subtle,
                      right: 10,
                      top: frameSize * ratio,
                    },
                  ]}
                />
              </React.Fragment>
            ))}
          </>
        ) : null}

        {motion === 'drift' ? (
          <>
            <View
              style={[
                styles.drift,
                { backgroundColor: line, left: 0, top: frameSize / 2 - 13 },
              ]}
            />
            <View
              style={[
                styles.drift,
                { backgroundColor: subtle, right: 0, top: frameSize / 2 + 12 },
              ]}
            />
          </>
        ) : null}

        {motion === 'pulse' ? (
          <>
            <View
              style={[
                styles.pulse,
                { borderColor: subtle, borderRadius: frameSize / 2, inset: 4 },
              ]}
            />
            <View
              style={[
                styles.pulse,
                { borderColor: line, borderRadius: frameSize / 2, inset: 15, opacity: 0.34 },
              ]}
            />
          </>
        ) : null}

        {motion === 'float' ? (
          <>
            <View
              style={[
                styles.vertical,
                {
                  backgroundColor: subtle,
                  height: 34,
                  left: frameSize / 2,
                  top: 5,
                },
              ]}
            />
            <View
              style={[styles.dot, { backgroundColor: line, left: frameSize / 2 - 3, top: 2 }]}
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: subtle, bottom: 2, left: frameSize / 2 - 3 },
              ]}
            />
          </>
        ) : null}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  canopyMark: {
    height: 28,
    position: 'absolute',
    width: 1,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  drift: {
    height: 1,
    position: 'absolute',
    width: 38,
  },
  horizon: {
    height: 1,
    position: 'absolute',
  },
  orbit: {
    borderWidth: 1,
    position: 'absolute',
  },
  pulse: {
    borderWidth: 1,
    position: 'absolute',
  },
  vertical: {
    position: 'absolute',
    width: 1,
  },
});
