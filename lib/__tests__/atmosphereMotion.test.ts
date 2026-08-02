import { describe, expect, it } from '@jest/globals';

import {
  getAtmosphereRasterScale,
  shouldAnimateAtmosphere,
} from '@/lib/atmosphereMotion';

describe('shouldAnimateAtmosphere', () => {
  it('uses static capture layers on Android', () => {
    expect(shouldAnimateAtmosphere(true, false, 'android')).toBe(false);
  });

  it('keeps ambient motion on a focused iOS screen', () => {
    expect(shouldAnimateAtmosphere(true, false, 'ios')).toBe(true);
  });

  it('stops motion when the screen is blurred or reduced motion is enabled', () => {
    expect(shouldAnimateAtmosphere(false, false, 'ios')).toBe(false);
    expect(shouldAnimateAtmosphere(true, true, 'ios')).toBe(false);
  });

  it('rasterizes the decorative Android layer at half resolution', () => {
    expect(getAtmosphereRasterScale('android')).toBe(0.5);
    expect(getAtmosphereRasterScale('ios')).toBe(1);
    expect(getAtmosphereRasterScale('web')).toBe(1);
  });
});
