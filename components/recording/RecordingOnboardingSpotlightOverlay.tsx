import React from 'react';
import { StyleSheet, View } from 'react-native';

export type RecordingSpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DimRect = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const OVERLAY_COLOR = 'rgba(5, 2, 14, 0.7)';

function expandAndClampRect(
  rect: RecordingSpotlightRect,
  padding: number,
  width: number,
  height: number
) {
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  const right = Math.min(width, rect.x + rect.width + padding);
  const bottom = Math.min(height, rect.y + rect.height + padding);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function normalizeRect(
  rect: RecordingSpotlightRect,
  originX: number,
  originY: number
): RecordingSpotlightRect {
  return {
    ...rect,
    x: rect.x - originX,
    y: rect.y - originY,
  };
}

function buildDimRects(width: number, height: number, holes: RecordingSpotlightRect[]): DimRect[] {
  const dimRects: DimRect[] = [];
  let currentY = 0;

  holes
    .filter((hole) => hole.width > 0 && hole.height > 0)
    .sort((a, b) => a.y - b.y)
    .forEach((hole, index) => {
      if (hole.y > currentY) {
        dimRects.push({
          key: `top-${index}`,
          x: 0,
          y: currentY,
          width,
          height: hole.y - currentY,
        });
      }

      if (hole.x > 0) {
        dimRects.push({
          key: `left-${index}`,
          x: 0,
          y: hole.y,
          width: hole.x,
          height: hole.height,
        });
      }

      const rightX = hole.x + hole.width;
      if (rightX < width) {
        dimRects.push({
          key: `right-${index}`,
          x: rightX,
          y: hole.y,
          width: width - rightX,
          height: hole.height,
        });
      }

      currentY = Math.max(currentY, hole.y + hole.height);
    });

  if (currentY < height) {
    dimRects.push({
      key: 'bottom',
      x: 0,
      y: currentY,
      width,
      height: height - currentY,
    });
  }

  return dimRects.filter((rect) => rect.width > 0 && rect.height > 0);
}

export function RecordingOnboardingSpotlightOverlay({
  width,
  height,
  originX = 0,
  originY = 0,
  targetRect,
  panelRect,
}: {
  width: number;
  height: number;
  originX?: number;
  originY?: number;
  targetRect: RecordingSpotlightRect | null;
  panelRect: RecordingSpotlightRect | null;
}) {
  if (!targetRect || width <= 0 || height <= 0) {
    return null;
  }

  const target = expandAndClampRect(normalizeRect(targetRect, originX, originY), 10, width, height);
  const panel = panelRect
    ? expandAndClampRect(normalizeRect(panelRect, originX, originY), 6, width, height)
    : null;
  const holes = panel ? [panel, target] : [target];
  const dimRects = buildDimRects(width, height, holes);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {dimRects.map((rect) => (
        <View
          key={rect.key}
          style={[
            styles.dimRect,
            {
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            },
          ]}
        />
      ))}
      {panel ? (
        <View
          style={[
            styles.panelRing,
            {
              left: panel.x,
              top: panel.y,
              width: panel.width,
              height: panel.height,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.targetRing,
          {
            left: target.x,
            top: target.y,
            width: target.width,
            height: target.height,
            borderRadius: Math.min(target.width, target.height) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  dimRect: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  panelRing: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(230, 222, 255, 0.28)',
    borderRadius: 18,
  },
  targetRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(230, 222, 255, 0.6)',
  },
});
