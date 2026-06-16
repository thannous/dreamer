/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { UnforgettableDreamPromptCard } from '@/components/recording/UnforgettableDreamPromptCard';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Pressable: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
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
      accent: '#8f7cff',
      accentLight: '#b4a8d4',
      backgroundCard: '#2d2150',
      divider: '#7f70bc',
      textPrimary: '#fff',
      textSecondary: '#b4a8d4',
    },
  }),
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { md: 8 },
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
    t: (key: string) => {
      const values: Record<string, string> = {
        'recording.remembered_prompt.eyebrow': 'Premier repère',
        'recording.remembered_prompt.title': 'Y a-t-il un rêve que tu n’as jamais oublié ?',
        'recording.remembered_prompt.body': 'Tu peux commencer Noctalia avec un souvenir de rêve.',
        'recording.remembered_prompt.yes': 'Oui, je le raconte',
        'recording.remembered_prompt.tonight': 'Je commence cette nuit',
        'recording.remembered_prompt.skip': 'Pas maintenant',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('UnforgettableDreamPromptCard', () => {
  it('renders the remembered dream prompt and calls every action', () => {
    const onStartRememberedDream = jest.fn();
    const onStartFreshTonight = jest.fn();
    const onDismiss = jest.fn();

    render(
      <UnforgettableDreamPromptCard
        onStartRememberedDream={onStartRememberedDream}
        onStartFreshTonight={onStartFreshTonight}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByTestId(TID.Component.UnforgettableDreamPrompt)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.UnforgettableDreamPromptTitle).textContent).toBe(
      'Y a-t-il un rêve que tu n’as jamais oublié ?'
    );
    expect(screen.getByText('Oui, je le raconte')).toBeTruthy();
    expect(screen.getByText('Je commence cette nuit')).toBeTruthy();
    expect(screen.getByText('Pas maintenant')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.UnforgettableDreamYes));
    fireEvent.click(screen.getByTestId(TID.Button.UnforgettableDreamTonight));
    fireEvent.click(screen.getByTestId(TID.Button.UnforgettableDreamSkip));

    expect(onStartRememberedDream).toHaveBeenCalledTimes(1);
    expect(onStartFreshTonight).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
