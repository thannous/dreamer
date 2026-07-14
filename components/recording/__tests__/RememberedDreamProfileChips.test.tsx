/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
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

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
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
        'recording.remembered_profile.accordion_title': 'Préciser ce souvenir',
        'recording.remembered_profile.expand_hint': 'Afficher les détails facultatifs',
        'recording.remembered_profile.collapse_hint': 'Masquer les détails facultatifs',
        'recording.remembered_profile.eyebrow': 'Repères du souvenir',
        'recording.remembered_profile.optional_badge': 'Facultatif',
        'recording.remembered_profile.title': 'Type de rêve, époque et détail marquant',
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
        onRememberedKindChange={onRememberedKindChange}
        onApproximatePeriodChange={onApproximatePeriodChange}
        onStrongestFragmentChange={onStrongestFragmentChange}
      />
    );

    expect(screen.getByTestId(TID.Component.RememberedDreamMetadata)).toBeTruthy();
    expect(screen.getByText('Préciser ce souvenir')).toBeTruthy();
    expect(screen.getByText('Facultatif')).toBeTruthy();
    expect(screen.getByText('Type de rêve, époque et détail marquant')).toBeTruthy();
    expect(screen.getByTestId('icon.chevron.down')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.RememberedDreamProfileChips)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamMetadataToggle));

    expect(screen.getByTestId(TID.Component.RememberedDreamProfileChips)).toBeTruthy();
    expect(screen.getByTestId('icon.chevron.up')).toBeTruthy();

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

    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamMetadataToggle));

    expect(onRememberedKindChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId(TID.Button.RememberedDreamKind('nightmare'))).toBeNull();
  });

  it('renders the complete form directly when presented in a dialog', () => {
    render(
      <RememberedDreamProfileChips
        presentation="form"
        onRememberedKindChange={jest.fn()}
        onApproximatePeriodChange={jest.fn()}
        onStrongestFragmentChange={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Component.RememberedDreamProfileChips)).toBeTruthy();
    expect(screen.getByText('Ce rêve ressemble surtout à')).toBeTruthy();
    expect(screen.getByText('Il remonte plutôt à')).toBeTruthy();
    expect(screen.getByText('Ce qui reste le plus fort')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.RememberedDreamMetadata)).toBeNull();
  });
});
