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
    spaceGrotesk: { medium: 'SpaceGrotesk-Medium' },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        'recording.draft_progress.count': '{count} characters',
        'recording.draft_progress.ready': 'Ready to save.',
        'recording.draft_progress.saved_locally': 'Draft saved on this device',
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
  it.each([
    ['', '0 characters'],
    [' ', '1 characters'],
    [' \n\t ', '4 characters'],
    [' A blue door ', '13 characters'],
  ])('attaches the stable ID directly to the raw character counter for %j', (value: string, countLabel: string) => {
    render(<RecordingDraftProgress value={value} />);

    const counter = screen.getByTestId(TID.Component.RecordingDraftProgressCount);
    expect(counter.tagName).toBe('SPAN');
    expect(counter.children).toHaveLength(0);
    expect(counter.textContent).toBe(countLabel);
  });

  it.each(['0 characters', '0 caractères'])('does not identify the nonempty draft %j as the zero counter', (draft: string) => {
    render(
      <>
        <div data-testid={TID.Input.DreamTranscript}>{draft}</div>
        <RecordingDraftProgress value={draft} />
      </>
    );

    expect(screen.getByText(draft).getAttribute('data-testid')).toBe(TID.Input.DreamTranscript);
    const counter = screen.getByTestId(TID.Component.RecordingDraftProgressCount);
    expect(counter.textContent).toBe(`${draft.length} characters`);
    expect(counter.textContent).not.toMatch(/^0 (caractères|characters|caracteres|Zeichen|caratteri)$/);
  });

  it('renders the actual localized count for a 601-character draft without a 600 limit', () => {
    render(<RecordingDraftProgress value={'x'.repeat(601)} />);

    const progress = screen.getByTestId(TID.Component.RecordingDraftProgress);
    expect(screen.getByTestId(TID.Component.RecordingDraftProgressCount).textContent).toBe('601 characters');
    expect(progress.textContent).toContain('601 characters');
    expect(progress.textContent).not.toContain('601/600');
    expect(progress.textContent).not.toContain('/600');
  });

  it('shows the saved-locally copy only after persistence is confirmed', () => {
    const { rerender } = render(<RecordingDraftProgress value="A blue door" />);
    const progress = screen.getByTestId(TID.Component.RecordingDraftProgress);
    expect(progress.textContent).not.toContain('Draft saved on this device');

    rerender(<RecordingDraftProgress value="A blue door" persisted />);
    expect(progress.textContent).toContain('Draft saved on this device');
  });
});
