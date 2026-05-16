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

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const values: Record<string, string> = {
        'recording.onboarding.step_count': `Étape ${params?.current}/${params?.total}`,
        'recording.onboarding.voice.title': 'Touchez le grand micro',
        'recording.onboarding.voice.body': 'Le bouton micro au centre lance la dictée vocale.',
        'recording.onboarding.skip': 'Ignorer',
        'recording.onboarding.next': 'Suivant',
        'recording.onboarding.done': 'Terminer',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RecordingOnboardingTour', () => {
  it('shows the current onboarding step and actions', () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();

    render(
      <RecordingOnboardingTour
        target="voice"
        index={0}
        total={3}
        onNext={onNext}
        onSkip={onSkip}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingOnboardingTour)).toBeTruthy();
    expect(screen.getByText('Étape 1/3')).toBeTruthy();
    expect(screen.getByText('Touchez le grand micro')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingNext));
    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingSkip));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('uses the done label on the last step', () => {
    render(
      <RecordingOnboardingTour
        target="voice"
        index={2}
        total={3}
        onNext={jest.fn()}
        onSkip={jest.fn()}
      />
    );

    expect(screen.getByText('Terminer')).toBeTruthy();
  });
});
