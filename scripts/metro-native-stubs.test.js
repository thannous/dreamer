'use strict';
/* global describe, expect, it */

const {
  MATERIAL_SYMBOLS_FONT,
  RC_WEB_SDK,
  isRevenueCatWebStubDisabled,
  resolveNativeStub,
} = require('./metro-native-stubs');

const EMPTY = { type: 'empty' };

describe('metro native stubs', () => {
  describe('RevenueCat web SDK', () => {
    it('stubs the web SDK on native when the flag is unset', () => {
      expect(resolveNativeStub(RC_WEB_SDK, 'android', {})).toEqual(EMPTY);
      expect(resolveNativeStub(RC_WEB_SDK, 'ios', {})).toEqual(EMPTY);
    });

    it('never stubs the web SDK on web', () => {
      expect(resolveNativeStub(RC_WEB_SDK, 'web', {})).toBeNull();
      expect(resolveNativeStub(RC_WEB_SDK, 'web', { NOCTALIA_DISABLE_RC_WEB_STUB: '1' })).toBeNull();
    });

    it('resolves the real SDK on native when NOCTALIA_DISABLE_RC_WEB_STUB=1', () => {
      const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1' };
      expect(isRevenueCatWebStubDisabled(env)).toBe(true);
      expect(resolveNativeStub(RC_WEB_SDK, 'android', env)).toBeNull();
      expect(resolveNativeStub(RC_WEB_SDK, 'ios', env)).toBeNull();
    });

    it('only accepts the exact value 1', () => {
      for (const value of ['', '0', 'true', 'yes']) {
        expect(resolveNativeStub(RC_WEB_SDK, 'android', { NOCTALIA_DISABLE_RC_WEB_STUB: value })).toEqual(EMPTY);
      }
    });

    it('keeps the stub on EAS build workers even if the flag leaks in', () => {
      const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1', EAS_BUILD: 'true' };
      expect(isRevenueCatWebStubDisabled(env)).toBe(false);
      expect(resolveNativeStub(RC_WEB_SDK, 'android', env)).toEqual(EMPTY);
    });
  });

  it('stubs the Material Symbols font on Android only, regardless of the flag', () => {
    const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1' };
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'android', {})).toEqual(EMPTY);
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'android', env)).toEqual(EMPTY);
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'ios', {})).toBeNull();
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'web', {})).toBeNull();
  });

  it('passes every other module through', () => {
    expect(resolveNativeStub('react-native-purchases', 'android', {})).toBeNull();
    expect(resolveNativeStub('@revenuecat/purchases-js', 'android', {})).toBeNull();
  });
});
