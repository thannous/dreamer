/** @jest-environment jsdom */

import {
  clearReturnToPaywallIntent,
  clearReturnToPaywallRestore,
  clearStayOnSettingsIntent,
  consumeReturnToPaywallTrigger,
  consumeStayOnSettingsDestination,
  peekReturnToPaywallRestore,
  peekReturnToPaywallTrigger,
  requestReturnToPaywallIntent,
  requestStayOnSettingsIntent,
} from '@/lib/navigationIntents';

describe('navigation intents', () => {
  beforeEach(() => {
    clearStayOnSettingsIntent();
    clearReturnToPaywallIntent();
    sessionStorage.clear();
  });

  it('returns the paywall trigger once and outranks the settings intent', () => {
    requestStayOnSettingsIntent();
    requestReturnToPaywallIntent('analysis_limit');

    // Peeking never consumes; consuming does.
    expect(peekReturnToPaywallTrigger()).toBe('analysis_limit');
    expect(peekReturnToPaywallTrigger()).toBe('analysis_limit');
    expect(consumeReturnToPaywallTrigger()).toBe('analysis_limit');
    expect(consumeReturnToPaywallTrigger()).toBeNull();
    // Consuming the paywall intent clears the settings intent too.
    expect(consumeStayOnSettingsDestination()).toBeNull();
  });

  it('persists the paywall trigger across a web reload when asked', () => {
    requestReturnToPaywallIntent('stats_profile', { persist: true });
    expect(JSON.parse(sessionStorage.getItem('dreamer:return_to_paywall') ?? 'null')?.trigger).toBe('stats_profile');

    expect(consumeReturnToPaywallTrigger()).toBe('stats_profile');
    expect(sessionStorage.getItem('dreamer:return_to_paywall')).toBeNull();
  });

  it('carries a guest restore request across a web reload and drops it once, keeping the way back', () => {
    requestReturnToPaywallIntent('settings', { persist: true });
    expect(peekReturnToPaywallRestore()).toBe(false);

    requestReturnToPaywallIntent('settings', { persist: true, restore: true });
    expect(JSON.parse(sessionStorage.getItem('dreamer:return_to_paywall') ?? 'null')?.restore).toBe(true);
    expect(peekReturnToPaywallRestore()).toBe(true);

    clearReturnToPaywallRestore();
    expect(peekReturnToPaywallRestore()).toBe(false);
    expect(JSON.parse(sessionStorage.getItem('dreamer:return_to_paywall') ?? 'null')?.restore).toBeUndefined();
    expect(peekReturnToPaywallTrigger()).toBe('settings');
  });

  it('expires a restore request with its paywall intent', () => {
    requestReturnToPaywallIntent('settings', { now: 1_000, restore: true });
    expect(peekReturnToPaywallRestore(1_000 + 11 * 60 * 1000)).toBe(false);
  });

  it('expires the paywall intent after its TTL', () => {
    requestReturnToPaywallIntent('settings', { now: 1_000 });
    expect(peekReturnToPaywallTrigger(1_000 + 5 * 60 * 1000)).toBe('settings');
    expect(peekReturnToPaywallTrigger(1_000 + 11 * 60 * 1000)).toBeNull();
    // Expired intents are dropped, not kept around.
    expect(peekReturnToPaywallTrigger(1_000)).toBeNull();
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

    expect(consumeStayOnSettingsDestination()).toBe('/settings');
  });
});
