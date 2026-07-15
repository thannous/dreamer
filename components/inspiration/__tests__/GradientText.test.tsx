/** @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { GradientText } from '../GradientText';

jest.mock('@expo/ui/community/masked-view', () => ({
  __esModule: true,
  default: ({ children, maskElement }: { children?: React.ReactNode; maskElement: React.ReactNode }) => (
    <div data-testid="expo-masked-view">
      <div data-testid="mask-element">{maskElement}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: LightTheme, mode: 'light' }),
  };
});

describe('GradientText', () => {
  afterEach(() => {
    Platform.OS = 'web';
    cleanup();
  });

  it('uses the Expo UI masked-view drop-in on native platforms', () => {
    Platform.OS = 'ios';

    render(<GradientText colors={['#111111', '#999999']}>Dream</GradientText>);

    expect(screen.getByTestId('expo-masked-view')).toBeTruthy();
    expect(screen.getByTestId('mask-element').textContent).toBe('Dream');
  });

  it('keeps the solid text fallback on web', () => {
    Platform.OS = 'web';

    render(<GradientText colors={['#111111', '#999999']}>Dream</GradientText>);

    expect(screen.queryByTestId('expo-masked-view')).toBeNull();
    expect(screen.getByText('Dream')).toBeTruthy();
  });
});
