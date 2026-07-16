/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

let mockFeatureAvailable = false;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <div data-testid="redirect">{href}</div>,
}));

jest.mock('@/lib/sleepSoundsFeature', () => ({
  isSleepSoundsAvailable: () => mockFeatureAvailable,
}));

jest.mock('@/components/sleep/SleepSoundsScreen', () => ({
  SleepSoundsScreen: () => <div data-testid="sleep-sounds-screen" />,
}));

const { default: SleepSoundsRoute } = require('@/app/sleep-sounds');

describe('sleep sounds route guard', () => {
  afterEach(() => {
    cleanup();
    mockFeatureAvailable = false;
  });

  it('redirects without mounting the player screen when unavailable', () => {
    render(<SleepSoundsRoute />);

    expect(screen.getByTestId('redirect').textContent).toBe('/');
    expect(screen.queryByTestId('sleep-sounds-screen')).toBeNull();
  });

  it('mounts the screen when the native feature is available', () => {
    mockFeatureAvailable = true;
    render(<SleepSoundsRoute />);

    expect(screen.getByTestId('sleep-sounds-screen')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
