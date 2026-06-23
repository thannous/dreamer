/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { AnalyzePromptSheet, FirstDreamSheet } from '@/components/recording/RecordingSheets';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: { OS: 'web' },
    ScrollView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({
    visible,
    title,
    subtitle,
    children,
  }: {
    visible: boolean;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
  }) => (
    visible ? (
      <section>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
      </section>
    ) : null
  ),
}));

jest.mock('@/components/journal/ReferenceImagePicker', () => ({
  ReferenceImagePicker: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'dark',
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#ddb070' },
    surface: {
      raised: '#10101f',
      soft: '#18182a',
      border: '#5a4b3d',
    },
    text: {
      primary: '#f7efe4',
      secondary: '#c7bdd1',
    },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    lora: {
      regular: 'Lora-Regular',
    },
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        'guest.first_dream.sheet.title': 'Great start!',
        'guest.first_dream.sheet.subtitle': 'Your first dream is saved.',
        'guest.first_dream.sheet.analyze': 'Analyze this dream',
        'guest.first_dream.sheet.journal': 'See journal',
        'guest.first_dream.sheet.dismiss': 'Not now',
        'recording.analyze_prompt.sheet.title': 'Dream saved',
        'recording.analyze_prompt.sheet.analyze': 'Analyze',
        'recording.analyze_prompt.sheet.journal': 'Journal',
        'recording.analyze_prompt.sheet.dismiss': 'Later',
        'recording.activation_insight.eyebrow': 'First read',
        'recording.activation_insight.summary.memory': 'This memory is saved as a remembered dream.',
        'recording.activation_insight.summary.signals': 'Noctalia already notices: {signals}.',
        'recording.activation_insight.summary.fragment': 'This fragment is enough to start your profile.',
        'recording.activation_insight.signal.memory': 'Memory',
        'recording.activation_insight.signal.emotion': 'Emotion',
        'recording.activation_insight.signal.place': 'Place',
        'recording.activation_insight.signal.person': 'Person',
        'recording.activation_insight.signal.symbol': 'Symbol',
        'recording.activation_insight.signal.recurrence': 'Pattern',
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

describe('RecordingSheets', () => {
  const noop = () => undefined;

  it('shows the activation insight after the first dream is saved', () => {
    render(
      <FirstDreamSheet
        visible
        onDismiss={noop}
        onAnalyze={noop}
        onJournal={noop}
        isPersisting={false}
        activationInsight={{
          tone: 'memory',
          signalIds: ['memory'],
          charCount: 24,
        }}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingActivationInsight)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingActivationInsightSummary).textContent).toBe(
      'This memory is saved as a remembered dream.'
    );
    expect(screen.getByText('Memory')).toBeTruthy();
  });

  it('shows the activation insight in the post-save analyze prompt', () => {
    render(
      <AnalyzePromptSheet
        visible
        onDismiss={noop}
        onAnalyze={noop}
        onJournal={noop}
        isPersisting={false}
        transcript="A blue room with rain"
        activationInsight={{
          tone: 'signals',
          signalIds: ['place', 'emotion'],
          charCount: 21,
        }}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingActivationInsight)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingActivationInsightSummary).textContent).toBe(
      'Noctalia already notices: Place, Emotion.'
    );
  });
});
