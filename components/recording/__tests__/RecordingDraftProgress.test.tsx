/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: { OS: 'web' },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
    spaceGrotesk: { medium: 'SpaceGrotesk-Medium' },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        'recording.draft_progress.count': '{count} characters',
        'recording.draft_progress.ready': 'Ready to save.',
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
  it('renders the actual localized count for a 601-character draft without a 600 limit', () => {
    render(<RecordingDraftProgress value={'x'.repeat(601)} />);

    const progress = screen.getByTestId(TID.Component.RecordingDraftProgress);
    expect(progress.textContent).toContain('601 characters');
    expect(progress.textContent).not.toContain('601/600');
    expect(progress.textContent).not.toContain('/600');
  });
});
