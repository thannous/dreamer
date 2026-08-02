export const shouldAnimateAtmosphere = (
  isFocused: boolean,
  prefersReducedMotion: boolean,
  platform: string
): boolean => isFocused && !prefersReducedMotion && platform !== 'android';

export const getAtmosphereRasterScale = (platform: string): number =>
  platform === 'android' ? 0.5 : 1;
