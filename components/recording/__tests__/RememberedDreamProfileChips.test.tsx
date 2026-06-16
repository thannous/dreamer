/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Pressable: ({
      accessibilityState,
      children,
      disabled,
      onPress,
      testID,
    }: {
      accessibilityState?: { selected?: boolean; disabled?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-pressed={accessibilityState?.selected ? 'true' : 'false'}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
    },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        'recording.remembered_profile.eyebrow': 'Repères du souvenir',
        'recording.remembered_profile.title': 'Aide Noctalia à comprendre ce rêve',
        'recording.remembered_profile.kind_label': 'Ce rêve ressemble surtout à',
        'recording.remembered_profile.kind.recurring': 'Récurrent',
        'recording.remembered_profile.period_label': 'Il remonte plutôt à',
        'recording.remembered_profile.period.childhood': 'L’enfance',
        'recording.remembered_profile.fragment_label': 'Ce qui reste le plus fort',
        'recording.remembered_profile.fragment.person': 'Une personne',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RememberedDreamProfileChips', () => {
  it('renders remembered dream qualifiers and emits selected profile signals', () => {
    const onRememberedKindChange = jest.fn();
    const onApproximatePeriodChange = jest.fn();
    const onStrongestFragmentChange = jest.fn();

    render(
      <RememberedDreamProfileChips
        rememberedKind="old"
        onRememberedKindChange={onRememberedKindChange}
        onApproximatePeriodChange={onApproximatePeriodChange}
        onStrongestFragmentChange={onStrongestFragmentChange}
      />
    );

    expect(screen.getByTestId(TID.Component.RememberedDreamProfileChips)).toBeTruthy();
    expect(screen.getByText('Aide Noctalia à comprendre ce rêve')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamKind('recurring')));
    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamPeriod('childhood')));
    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamFragment('person')));

    expect(onRememberedKindChange).toHaveBeenCalledWith('recurring');
    expect(onApproximatePeriodChange).toHaveBeenCalledWith('childhood');
    expect(onStrongestFragmentChange).toHaveBeenCalledWith('person');
  });

  it('does not emit profile changes while disabled', () => {
    const onRememberedKindChange = jest.fn();

    render(
      <RememberedDreamProfileChips
        disabled
        rememberedKind="old"
        onRememberedKindChange={onRememberedKindChange}
        onApproximatePeriodChange={jest.fn()}
        onStrongestFragmentChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamKind('nightmare')));

    expect(onRememberedKindChange).not.toHaveBeenCalled();
  });
});
