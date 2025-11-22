/**
 * Mock React Native for testing purposes
 * Provides minimal implementations needed for service tests
 */
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
};

// Add other commonly used React Native exports if needed
export const Dimensions = {
  get: () => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  }),
};

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (layoutSize: number) => layoutSize * 2,
  roundToNearestPixel: (layoutSize: number) => Math.round(layoutSize * 2) / 2,
};
