/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingOnboardingTour } from '@/components/recording/RecordingOnboardingTour';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  const View = React.forwardRef(
    ({ children, testID }: { children?: React.ReactNode; testID?: string }, ref: React.Ref<HTMLDivElement>) => (
      <div ref={ref} data-testid={testID}>{children}</div>
    )
  );
  View.displayName = 'View';

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
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View,
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark', shadows: { xl: {} } }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#ddb070', soft: '#efd3a8' },
    action: { primary: '#ddb070', primaryText: '#171322' },
    surface: {
      raised: '#1f2847',
      soft: '#18182a',
      border: '#5a4b3d',
      borderStrong: '#886f54',
    },
    text: { primary: '#fff', secondary: '#ccc' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { bold: 'Bold', medium: 'Medium' } },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, number>) => ({
      'recording.guide.step_mode': 'Appuie sur le sélecteur de mode.',
      'recording.guide.step_modes': 'Choisis la façon dont tu préfères raconter ton rêve.',
      'recording.guide.step_control_text': 'Appuie dans le champ mis en évidence.',
      'recording.guide.step_control_voice': 'Appuie sur le micro mis en évidence.',
      'recording.guide.done': 'Terminer',
      'recording.guide.dismiss': 'Fermer le guide',
      'recording.onboarding.step_count': `Étape ${params?.current}/${params?.total}`,
    } as Record<string, string>)[key] ?? key,
  }),
}));

const defaultProps = {
  bottomOffset: 80,
  inputMode: 'text' as const,
  onDone: jest.fn(),
  onDismiss: jest.fn(),
};

describe('RecordingOnboardingTour', () => {
  it('guides the user to the mode selector first', () => {
    render(<RecordingOnboardingTour {...defaultProps} step={0} />);

    expect(screen.getByTestId(TID.Component.RecordingOnboardingTour)).toBeTruthy();
    expect(screen.getByText('Étape 1/3')).toBeTruthy();
    expect(screen.getByText('Appuie sur le sélecteur de mode.')).toBeTruthy();
    expect(screen.queryByText('Terminer')).toBeNull();
  });

  it('keeps the second step focused on choosing a mode', () => {
    render(<RecordingOnboardingTour {...defaultProps} step={1} />);

    expect(screen.getByText('Étape 2/3')).toBeTruthy();
    expect(screen.getByText('Choisis la façon dont tu préfères raconter ton rêve.')).toBeTruthy();
  });

  it('highlights the active control and finishes from the third step', () => {
    const onDone = jest.fn();
    render(
      <RecordingOnboardingTour
        {...defaultProps}
        step={2}
        inputMode="voice"
        onDone={onDone}
      />
    );

    expect(screen.getByTestId('icon.mic')).toBeTruthy();
    expect(screen.getByText('Étape 3/3')).toBeTruthy();
    expect(screen.getByText('Appuie sur le micro mis en évidence.')).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingNext));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed at any step', () => {
    const onDismiss = jest.fn();
    render(<RecordingOnboardingTour {...defaultProps} step={2} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId(TID.Button.RecordingOnboardingSkip));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
