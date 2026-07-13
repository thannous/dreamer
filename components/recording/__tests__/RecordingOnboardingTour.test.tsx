/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingOnboardingTour } from '@/components/recording/RecordingOnboardingTour';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({ visible, title, children, actions, testID }: any) => visible ? (
    <section data-testid={testID}>
      <h1>{title}</h1>
      {children}
      <button data-testid={actions.primaryTestID} onClick={actions.onPrimary}>
        {actions.primaryLabel}
      </button>
      <button data-testid={actions.linkTestID} onClick={actions.onLink}>
        {actions.linkLabel}
      </button>
    </section>
  ) : null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#ddb070' },
    surface: { soft: '#18182a', border: '#5a4b3d' },
    text: { primary: '#fff', secondary: '#ccc' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { bold: 'Bold', medium: 'Medium' } },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, number>) => ({
      'recording.guide.title': 'Guide de capture',
      'recording.guide.step_mode': 'Choisis Écrit ou Vocal avec le sélecteur de mode.',
      'recording.guide.step_control': 'Utilise ensuite le champ ou le micro.',
      'recording.guide.next': 'Suivant',
      'recording.guide.done': 'Terminer',
      'recording.guide.dismiss': 'Fermer le guide',
      'recording.onboarding.step_count': `Étape ${params?.current}/${params?.total}`,
    } as Record<string, string>)[key] ?? key,
  }),
}));

describe('RecordingOnboardingTour', () => {
  it('shows only the mode cue first and advances', () => {
    const onNext = jest.fn();
    render(
      <RecordingOnboardingTour
        visible
        step={0}
        inputMode="text"
        onNext={onNext}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingOnboardingTour)).toBeTruthy();
    expect(screen.getByText('Étape 1/2')).toBeTruthy();
    expect(screen.getByText('Choisis Écrit ou Vocal avec le sélecteur de mode.')).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingNext));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('uses the active control and done label on the second cue', () => {
    render(
      <RecordingOnboardingTour
        visible
        step={1}
        inputMode="voice"
        onNext={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByTestId('icon.mic')).toBeTruthy();
    expect(screen.getByText('Étape 2/2')).toBeTruthy();
    expect(screen.getByText('Utilise ensuite le champ ou le micro.')).toBeTruthy();
    expect(screen.getByText('Terminer')).toBeTruthy();
  });

  it('can be dismissed without changing capture preferences', () => {
    const onDismiss = jest.fn();
    render(
      <RecordingOnboardingTour
        visible
        step={0}
        inputMode="text"
        onNext={jest.fn()}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingSkip));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
