/** @jest-environment jsdom */

import {
  clearStayOnSettingsIntent,
  consumeStayOnSettingsDestination,
  requestStayOnSettingsIntent,
} from '@/lib/navigationIntents';

describe('navigation intents', () => {
  beforeEach(() => {
    clearStayOnSettingsIntent();
    sessionStorage.clear();
  });

  it('consumes a Lucid destination exactly once', () => {
    requestStayOnSettingsIntent({ destination: '/lucid/(tabs)/settings' });

    expect(consumeStayOnSettingsDestination()).toBe('/lucid/(tabs)/settings');
    expect(consumeStayOnSettingsDestination()).toBeNull();
  });

  it('persists the destination for a web OAuth round trip', () => {
    requestStayOnSettingsIntent({
      destination: '/lucid/(tabs)/settings',
      persist: true,
    });

    expect(sessionStorage.getItem('dreamer:return_to_settings')).toBe(
      '/lucid/(tabs)/settings'
    );
    expect(consumeStayOnSettingsDestination()).toBe('/lucid/(tabs)/settings');
    expect(sessionStorage.getItem('dreamer:return_to_settings')).toBeNull();
  });

  it('normalizes an old persisted flag to the legacy settings destination', () => {
    sessionStorage.setItem('dreamer:return_to_settings', '1');

    expect(consumeStayOnSettingsDestination()).toBe('/(tabs)/settings');
  });
});
