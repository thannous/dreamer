/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

let mockPlatform = 'android';
jest.mock('react-native', () => ({ Platform: { get OS() { return mockPlatform; } } }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <div data-testid="redirect">{href}</div>,
}));
jest.mock('@/components/sleep/SleepSoundsScreen', () => ({
  SleepSoundsScreen: () => <div data-testid="sleep-sounds-screen" />,
}));
const { default: SleepSoundsRoute } = require('@/app/sleep-sounds');
const originalFlag = process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;
const originalExpoOs = process.env.EXPO_OS;

afterEach(() => {
  cleanup();
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;
  else process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = originalFlag;
  if (originalExpoOs === undefined) delete process.env.EXPO_OS;
  else process.env.EXPO_OS = originalExpoOs;
});

describe('sleep sounds route guard', () => {
  it.each(['android', 'ios'])('uses the running %s platform even without a matching build-time environment', (platform) => {
    mockPlatform = platform;
    process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = 'true';
    process.env.EXPO_OS = 'unknown';
    render(<SleepSoundsRoute />);
    expect(screen.getByTestId('sleep-sounds-screen')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
  it.each(['web', 'unknown'])('keeps %s unavailable even with the feature flag', (platform) => {
    mockPlatform = platform;
    process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = 'true';
    render(<SleepSoundsRoute />);
    expect(screen.getByTestId('redirect').textContent).toBe('/');
    expect(screen.queryByTestId('sleep-sounds-screen')).toBeNull();
  });
  it.each(['false', undefined])('keeps the player unmounted with flag %s', (flag) => {
    mockPlatform = 'android';
    if (flag === undefined) delete process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;
    else process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = flag;
    render(<SleepSoundsRoute />);
    expect(screen.getByTestId('redirect').textContent).toBe('/');
    expect(screen.queryByTestId('sleep-sounds-screen')).toBeNull();
  });
});
