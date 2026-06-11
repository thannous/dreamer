/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingOnboardingTour } from '@/components/recording/RecordingOnboardingTour';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Pressable: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
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
      accentLight: '#b4a8d4',
      backgroundCard: '#2d2150',
      backgroundSecondary: '#6353a0',
      divider: '#7f70bc',
      textPrimary: '#fff',
      textSecondary: '#b4a8d4',
    },
  }),
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { full: 999, md: 8 },
    spacing: { md: 16 },
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const values: Record<string, string> = {
        'recording.onboarding.step_count': `Étape ${params?.current}/${params?.total}`,
        'recording.onboarding.voice.body': 'Appuie sur le micro pour dicter ton rêve.',
        'recording.onboarding.text.body': 'Appuie sur le champ texte pour écrire ton rêve.',
        'recording.onboarding.preference.badge': 'Préférence',
        'recording.onboarding.preference.title': 'Comment veux-tu enregistrer tes rêves ?',
        'recording.onboarding.preference.voice_detail': 'Un grand micro d’abord, avec le texte juste en dessous.',
        'recording.onboarding.preference.text_detail': 'Le champ texte d’abord, avec la dictée en option.',
        'recording.onboarding.preference.settings_hint': 'Tu pourras changer ce choix à tout moment dans les paramètres de capture.',
        'recording.preference.voice': 'Vocal',
        'recording.preference.text': 'Écrit',
        'recording.onboarding.skip': 'Ignorer',
        'recording.onboarding.next': 'Suivant',
        'recording.onboarding.done': 'Terminer',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RecordingOnboardingTour', () => {
  it('asks for the preferred capture view and persists the choice', () => {
    const onSelectPreference = jest.fn();
    const onSkip = jest.fn();

    render(
      <RecordingOnboardingTour
        variant="preference"
        value="text"
        onSelectPreference={onSelectPreference}
        onSkip={onSkip}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingOnboardingTour)).toBeTruthy();
    expect(screen.getByText('Préférence')).toBeTruthy();
    expect(screen.getByText('Comment veux-tu enregistrer tes rêves ?')).toBeTruthy();
    expect(screen.getByText('Vocal')).toBeTruthy();
    expect(screen.getByText('Écrit')).toBeTruthy();
    expect(screen.getByText('Écrit').compareDocumentPosition(screen.getByText('Vocal'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText('Tu pourras changer ce choix à tout moment dans les paramètres de capture.')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingChooseVoice));
    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingSkip));

    expect(onSelectPreference).toHaveBeenCalledWith('voice');
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows an explanatory step after the preference choice', () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();

    render(
      <RecordingOnboardingTour
        variant="step"
        target="voice"
        index={0}
        total={2}
        onNext={onNext}
        onSkip={onSkip}
      />
    );

    expect(screen.getByText('Étape 1/2')).toBeTruthy();
    expect(screen.getByText('Appuie sur le micro pour dicter ton rêve.')).toBeTruthy();
    expect(screen.getByText('Suivant')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingNext));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('uses the done label on the last explanatory step', () => {
    render(
      <RecordingOnboardingTour
        variant="step"
        target="text"
        index={1}
        total={2}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />
    );

    expect(screen.getByText('Terminer')).toBeTruthy();
  });
});
