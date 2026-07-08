/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingActivationInsightCard } from '@/components/recording/RecordingActivationInsightCard';
import {
  AnalyzePromptSheet,
  FirstDreamSheet,
  GuestLimitSheet,
  QuotaLimitSheet,
} from '@/components/recording/RecordingSheets';
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
    titleTestID,
    children,
    actions,
  }: {
    visible: boolean;
    title: string;
    subtitle?: string;
    titleTestID?: string;
    children?: React.ReactNode;
    actions?: {
      primaryLabel: string;
      primaryTestID?: string;
      secondaryLabel?: string;
      secondaryTestID?: string;
      linkLabel?: string;
      linkTestID?: string;
    };
  }) => (
    visible ? (
      <section>
        <h1 data-testid={titleTestID}>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
        {actions ? (
          <div>
            <button data-testid={actions.primaryTestID}>{actions.primaryLabel}</button>
            {actions.secondaryLabel ? (
              <button data-testid={actions.secondaryTestID}>{actions.secondaryLabel}</button>
            ) : null}
            {actions.linkLabel ? (
              <button data-testid={actions.linkTestID}>{actions.linkLabel}</button>
            ) : null}
          </div>
        ) : null}
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
        'guest.first_dream.sheet.remembered_title': 'Memory saved',
        'guest.first_dream.sheet.remembered_subtitle': 'This remembered dream is in your journal.',
        'guest.first_dream.sheet.remembered_primary': 'View this memory',
        'guest.first_dream.sheet.remembered_analyze': 'Analyze this memory',
        'guest.first_dream.sheet.dismiss': 'Not now',
        'recording.analyze_prompt.sheet.title': 'Dream saved',
        'recording.analyze_prompt.sheet.analyze': 'Analyze',
        'recording.analyze_prompt.sheet.journal': 'Journal',
        'recording.analyze_prompt.sheet.dismiss': 'Later',
        'recording.guest_limit_sheet.title': 'Limit reached',
        'recording.guest_limit_sheet.message': 'Your dream is still here.',
        'recording.guest_limit_sheet.draft_title': 'Your text is not lost',
        'recording.guest_limit_sheet.draft_message': 'Keep this sheet open: the draft stays on this screen while you create the free account.',
        'recording.guest_limit_sheet.cta': 'Go to account',
        'recording.guest_limit_sheet.back_to_text': 'Back to text',
        'recording.analysis_limit.title_guest': 'Analysis limit reached',
        'recording.analysis_limit.message_guest': 'You have used your {limit} guest analyses.',
        'recording.analysis_limit.assurance_guest': 'The {limit} guest analyses are free. Your text stays here; the free account simply saves it and lets you continue.',
        'recording.analysis_limit.cta_guest': 'Create free account',
        'recording.analysis_limit.journal': 'Open journal',
        'recording.analysis_limit.dismiss': 'Later',
        'recording.remembered.default_title': 'Dream memory',
        'recording.activation_insight.eyebrow': 'First read',
        'recording.activation_insight.summary.memory': 'This memory is saved as a remembered dream.',
        'recording.activation_insight.summary.memory_draft': 'This memory can already become a marker for your profile.',
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

  it('uses remembered dream copy and journal-first actions in the first-dream sheet', () => {
    render(
      <FirstDreamSheet
        visible
        isRememberedDream
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

    expect(screen.getByTestId(TID.Text.FirstDreamSheetTitle).textContent).toBe('Memory saved');
    expect(screen.getByText('This remembered dream is in your journal.')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FirstDreamJournal).textContent).toBe('View this memory');
    expect(screen.getByTestId(TID.Button.FirstDreamAnalyze).textContent).toBe('Analyze this memory');
    expect(screen.queryByText('Your first dream is saved.')).toBeNull();
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

  it('uses remembered dream title in the post-save analyze prompt', () => {
    render(
      <AnalyzePromptSheet
        visible
        isRememberedDream
        onDismiss={noop}
        onAnalyze={noop}
        onJournal={noop}
        isPersisting={false}
        transcript="A blue room with rain"
        activationInsight={{
          tone: 'memory',
          signalIds: ['memory'],
          charCount: 21,
        }}
      />
    );

    expect(screen.getByTestId(TID.Text.AnalyzePromptTitle).textContent).toBe('Dream memory');
  });

  it('uses draft copy before save', () => {
    render(
      <RecordingActivationInsightCard
        context="draft"
        insight={{
          tone: 'memory',
          signalIds: ['memory', 'place'],
          charCount: 18,
        }}
      />
    );

    expect(screen.getByTestId(TID.Text.RecordingActivationInsightSummary).textContent).toBe(
      'This memory can already become a marker for your profile.'
    );
  });

  it('reassures guests that a draft is not lost at the recording limit', () => {
    render(
      <GuestLimitSheet
        visible
        onClose={noop}
        onCta={noop}
      />
    );

    expect(screen.getByText('Your text is not lost')).toBeTruthy();
    expect(screen.getByText(
      'Keep this sheet open: the draft stays on this screen while you create the free account.'
    )).toBeTruthy();
    expect(screen.getByTestId(TID.Button.GuestLimitBackToText).textContent).toBe('Back to text');
  });

  it('makes guest analysis quota continuation feel free and recoverable', () => {
    render(
      <QuotaLimitSheet
        visible
        onClose={noop}
        onPrimary={noop}
        onSecondary={noop}
        onLink={noop}
        mode="limit"
        tier="guest"
        usageLimit={2}
      />
    );

    expect(screen.getByText(
      'The 2 guest analyses are free. Your text stays here; the free account simply saves it and lets you continue.'
    )).toBeTruthy();
  });
});
