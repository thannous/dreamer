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
        'recording.draft_progress.count': '{count} characters',
        'recording.draft_progress.count_one': '{count} character',
        'recording.draft_progress.ready': 'Ready to save.',
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
  it('hides the counter while the draft is empty', () => {
    render(<RecordingDraftProgress value="" />);

    expect(screen.queryByTestId(TID.Component.RecordingDraftProgressCount)).toBeNull();
  });

  it.each([
    [' ', '1 character'],
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

  it('says how far a draft is from the maximum length once it nears it', () => {
    render(<RecordingDraftProgress value={'x'.repeat(18500)} />);
    const counter = screen.getByTestId(TID.Component.RecordingDraftProgressCount);
    expect(counter.textContent).toBe('18,500 / 20,000 characters');
  });

  it('renders the actual localized count for a 601-character draft without a 600 limit', () => {
    render(<RecordingDraftProgress value={'x'.repeat(601)} />);

    const progress = screen.getByTestId(TID.Component.RecordingDraftProgress);
    expect(screen.getByTestId(TID.Component.RecordingDraftProgressCount).textContent).toBe('601 characters');
    expect(progress.textContent).toContain('601 characters');
    expect(progress.textContent).not.toContain('601/600');
    expect(progress.textContent).not.toContain('/600');
  });
});
