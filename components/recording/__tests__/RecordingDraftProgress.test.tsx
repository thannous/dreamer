/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    Platform: { OS: 'web' },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#d4a574',
      divider: '#7f70bc',
      textSecondary: '#b4a8d4',
    },
    mode: 'dark',
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { secondary: '#b4a8d4' },
    surface: { border: '#7f70bc' },
    accent: { base: '#d4a574' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    outfit: { medium: 'Outfit-Medium' },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        'recording.length.near': '{count} / {max} characters',
      };
      let value = values[key] ?? key;
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(`{${paramKey}}`, String(paramValue));
        }
      }
      return value;
    },
  }),
}));

describe('RecordingDraftProgress', () => {
  it.each(['', ' ', 'A blue door', 'x'.repeat(17999)])('shows nothing for a draft far from the maximum (%#)', (value: string) => {
    render(<RecordingDraftProgress value={value} />);

    expect(screen.queryByTestId(TID.Component.RecordingDraftProgress)).toBeNull();
    expect(screen.queryByTestId(TID.Component.RecordingDraftProgressCount)).toBeNull();
  });

  it('counts against the maximum once it comes near', () => {
    render(<RecordingDraftProgress value={'x'.repeat(18500)} />);

    expect(screen.getByTestId(TID.Component.RecordingDraftProgressCount).textContent).toBe('18,500 / 20,000 characters');
  });
});
