import { useWindowDimensions } from 'react-native';

type ViewportMetrics = {
  width: number;
  height: number;
  fontScale: number;
};

/**
 * A compact layout changes hierarchy and spacing, never the user's text scale.
 *
 * The height threshold covers short phones such as the iPhone SE, while the
 * width threshold catches narrow Android devices even when they are tall.
 * Large Dynamic Type opts into the same reflow before labels start wrapping.
 */
export function isCompactLayout({ width, height, fontScale }: ViewportMetrics): boolean {
  return width < 375 || height < 700 || fontScale > 1.15;
}

export function useCompactLayout(): boolean {
  return isCompactLayout(useWindowDimensions());
}
