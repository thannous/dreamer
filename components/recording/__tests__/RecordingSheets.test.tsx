/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingActivationInsightCard } from '@/components/recording/RecordingActivationInsightCard';
import {
  AnalyzePromptSheet,
  FirstDreamSheet,
  GuestLimitSheet,
  PostSaveOfferSheet,
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
    headerIcon,
    titleTestID,
    children,
    actions,
  }: {
    visible: boolean;
    title: string;
    subtitle?: string;
    headerIcon?: string;
    titleTestID?: string;
    children?: React.ReactNode;
    actions?: {
      primaryLabel: string;
      primaryDetail?: string;
      primaryIcon?: string;
      onPrimary: () => void;
      primaryTestID?: string;
      secondaryLabel?: string;
      secondaryDetail?: string;
      secondaryIcon?: string;
      onSecondary?: () => void;
      secondaryTestID?: string;
      linkLabel?: string;
      onLink?: () => void;
      linkTestID?: string;
      supportingContent?: React.ReactNode;
    };
  }) => (
    visible ? (
      <section>
        <h1 data-testid={titleTestID}>{title}</h1>
        {headerIcon ? <span data-testid={`header-icon.${headerIcon}`} /> : null}
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
        {actions ? (
          <div>
            <button data-testid={actions.primaryTestID} onClick={actions.onPrimary}>{actions.primaryLabel}</button>
            {actions.primaryDetail ? <span>{actions.primaryDetail}</span> : null}
            {actions.primaryIcon ? <span data-testid={`action-icon.${actions.primaryIcon}`} /> : null}
            {actions.secondaryLabel ? (
              <>
                <button data-testid={actions.secondaryTestID} onClick={actions.onSecondary}>{actions.secondaryLabel}</button>
                {actions.secondaryDetail ? <span>{actions.secondaryDetail}</span> : null}
                {actions.secondaryIcon ? <span data-testid={`action-icon.${actions.secondaryIcon}`} /> : null}
              </>
            ) : null}
            {actions.supportingContent}
            {actions.linkLabel ? (
              <button data-testid={actions.linkTestID} onClick={actions.onLink}>{actions.linkLabel}</button>
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
    accent: { base: '#ddb070', soft: '#f0d5ae', strong: '#9a6332' },
    surface: {
      raised: '#10101f',
      soft: '#18182a',
      border: '#5a4b3d',
    },
    status: {
      danger: { background: '#300', border: '#f66', text: '#fee' },
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
        'guest.first_dream.sheet.subtitle': 'Your first dream is safely in your journal.',
        'guest.first_dream.sheet.analyze': 'Analyze this dream',
        'guest.first_dream.sheet.analyze_detail': 'Discover its first patterns and emotions',
        'guest.first_dream.sheet.journal': 'View my dream',
        'guest.first_dream.sheet.journal_detail': 'Review or add to what you recorded',
        'guest.first_dream.sheet.remembered_title': 'Memory saved',
        'guest.first_dream.sheet.remembered_subtitle': 'This remembered dream is in your journal.',
        'guest.first_dream.sheet.remembered_primary': 'View this memory',
        'guest.first_dream.sheet.remembered_analyze': 'Analyze this memory',
        'guest.first_dream.sheet.dismiss': 'Not now',
        'recording.analyze_prompt.sheet.title': 'Dream saved',
        'recording.analyze_prompt.sheet.analyze': 'Analyze',
        'recording.analyze_prompt.sheet.journal': 'Journal',
        'recording.analyze_prompt.sheet.dismiss': 'Later',
        'recording.analysis_offer.title': 'Your dream is saved',
        'recording.analysis_offer.quota_remaining': 'One analysis will be used · {remaining} remaining',
        'recording.analysis_offer.unlimited': 'Analysis included with Noctalia Plus',
        'recording.analysis_offer.unknown': 'Your dream is safe. Your quota will be checked before analysis.',
        'recording.analysis_offer.exhausted': 'Your dream is safe. Sign in or upgrade to analyze it.',
        'recording.analysis_offer.launch': 'Start analysis',
        'recording.analysis_offer.view': 'View my dream',
        'recording.analysis_offer.later': 'Later',
        'recording.analysis_offer.retry': 'Try again',
        'recording.analysis_offer.error': 'The analysis could not start. Your dream is still saved.',
        'recording.memory_offer.title': 'Memory saved',
        'recording.memory_offer.subtitle': 'Your memory is in the journal.',
        'recording.memory_offer.view': 'View my memory',
        'recording.memory_offer.analyze': 'Analyze it',
        'recording.memory_offer.later': 'Later',
        'recording.analysis_limit.cta_login': 'Sign in',
        'recording.analysis_limit.cta_free': 'Upgrade',
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

  it('explains the two next-step paths for a first recorded dream', () => {
    render(
      <FirstDreamSheet
        visible
        onDismiss={noop}
        onAnalyze={noop}
        onJournal={noop}
        isPersisting={false}
        activationInsight={{
          tone: 'fragment',
          signalIds: [],
          charCount: 24,
        }}
      />
    );

    expect(screen.getByText('Your first dream is safely in your journal.')).toBeTruthy();
    expect(screen.getByTestId('header-icon.checkmark.circle.fill')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FirstDreamAnalyze).textContent).toBe('Analyze this dream');
    expect(screen.getByText('Discover its first patterns and emotions')).toBeTruthy();
    expect(screen.getByTestId('action-icon.moon.stars.fill')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FirstDreamJournal).textContent).toBe('View my dream');
    expect(screen.getByText('Review or add to what you recorded')).toBeTruthy();
    expect(screen.getByTestId('action-icon.book.closed.fill')).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingActivationInsightSummary).textContent).toBe(
      'This fragment is enough to start your profile.'
    );
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

  it('requires an explicit action before spending an analysis', () => {
    const onPrimary = jest.fn();
    render(
      <PostSaveOfferSheet
        visible
        kind="analysis"
        quotaState="known"
        remaining={2}
        primaryAction="launch"
        isPersisting={false}
        onDismiss={noop}
        onPrimary={onPrimary}
        onJournal={noop}
      />
    );

    expect(screen.getByText('Your dream is saved')).toBeTruthy();
    expect(screen.getByText('One analysis will be used · 2 remaining')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.AnalysisOfferPrimary).textContent).toBe('Start analysis');
    expect(screen.getByTestId(TID.Button.AnalysisOfferJournal).textContent).toBe('View my dream');
    expect(screen.getByTestId(TID.Button.AnalysisOfferLater).textContent).toBe('Later');
    expect(onPrimary).not.toHaveBeenCalled();
    screen.getByTestId(TID.Button.AnalysisOfferPrimary).click();
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('keeps a remembered dream journal-first', () => {
    render(
      <PostSaveOfferSheet
        visible
        kind="memory"
        quotaState="unknown"
        primaryAction="launch"
        isPersisting={false}
        onDismiss={noop}
        onPrimary={noop}
        onJournal={noop}
      />
    );

    expect(screen.getByText('Memory saved')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.AnalysisOfferPrimary).textContent).toBe('View my memory');
    expect(screen.getByTestId(TID.Button.AnalysisOfferJournal).textContent).toBe('Analyze it');
  });

  it('announces a recoverable analysis error and keeps retry available', () => {
    render(
      <PostSaveOfferSheet
        visible
        kind="analysis"
        quotaState="known"
        remaining={1}
        primaryAction="retry"
        isPersisting={false}
        onDismiss={noop}
        onPrimary={noop}
        onJournal={noop}
      />
    );

    expect(screen.getByText('The analysis could not start. Your dream is still saved.')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.AnalysisOfferPrimary).textContent).toBe('Try again');
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
