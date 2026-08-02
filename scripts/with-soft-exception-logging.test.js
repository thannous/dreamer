'use strict';

const appConfig = require('../app.json');
const {
  applyMainApplicationInstall,
  buildSoftExceptionLoggerSource,
} = require('../plugins/withSoftExceptionLogging');

const BASE_MAIN_APPLICATION = `package com.tanuki75.noctalia

import android.app.Application

class MainApplication : Application(), ReactApplication {

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

describe('withSoftExceptionLogging', () => {
  it('is registered in the Expo config', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withSoftExceptionLogging');
  });

  describe('applyMainApplicationInstall', () => {
    it('installs the listener before React Native starts', () => {
      const result = applyMainApplicationInstall(BASE_MAIN_APPLICATION);

      const installIndex = result.indexOf('NoctaliaSoftExceptionLogger.install(this)');
      const loadIndex = result.indexOf('loadReactNative(this)');

      expect(installIndex).toBeGreaterThan(-1);
      expect(installIndex).toBeLessThan(loadIndex);
    });

    it('preserves the existing onCreate body', () => {
      const result = applyMainApplicationInstall(BASE_MAIN_APPLICATION);

      expect(result).toContain('super.onCreate()');
      expect(result).toContain('loadReactNative(this)');
      expect(result).toContain('ApplicationLifecycleDispatcher.onApplicationCreate(this)');
    });

    it('keeps the original indentation', () => {
      const result = applyMainApplicationInstall(BASE_MAIN_APPLICATION);

      expect(result).toContain('    NoctaliaSoftExceptionLogger.install(this)');
    });

    it('is idempotent across repeated prebuilds', () => {
      const once = applyMainApplicationInstall(BASE_MAIN_APPLICATION);
      const twice = applyMainApplicationInstall(once);

      expect(twice).toBe(once);
      expect(twice.match(/NoctaliaSoftExceptionLogger\.install\(this\)/g)).toHaveLength(1);
    });

    it('fails loudly when onCreate cannot be found', () => {
      expect(() => applyMainApplicationInstall('class MainApplication : Application()')).toThrow(
        /Unable to locate MainApplication\.onCreate/
      );
    });
  });

  describe('buildSoftExceptionLoggerSource', () => {
    it('emits Java in the application package', () => {
      const source = buildSoftExceptionLoggerSource('com.tanuki75.noctalia');

      expect(source).toContain('package com.tanuki75.noctalia;');
      expect(source).toContain('public final class NoctaliaSoftExceptionLogger');
    });

    it('keeps logging soft exceptions itself', () => {
      // React Native stops logging soft exceptions once any listener is
      // registered, so a listener that does not log would reduce observability.
      const source = buildSoftExceptionLoggerSource('com.tanuki75.noctalia');

      expect(source).toContain('Log.e(TAG, "category=" + category, cause)');
    });

    it('persists synchronously so entries survive an imminent crash', () => {
      const source = buildSoftExceptionLoggerSource('com.tanuki75.noctalia');

      expect(source).toContain('.commit()');
      expect(source).not.toContain('.apply()');
    });

    it('bounds what it retains', () => {
      const source = buildSoftExceptionLoggerSource('com.tanuki75.noctalia');

      expect(source).toContain('MAX_ENTRIES = 20');
      expect(source).toContain('MAX_STACK_FRAMES = 12');
    });

    it('requires an Android package name', () => {
      expect(() => buildSoftExceptionLoggerSource(undefined)).toThrow(
        /requires an Android package name/
      );
    });
  });
});
