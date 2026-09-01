/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingInputModeSelect } from '@/components/recording/RecordingInputModeSelect';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: ({
      children,
      disabled,
      onPress,
      testID,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean; disabled?: boolean };
    }) => (
      <button
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected ? 'true' : 'false'}
        role={accessibilityRole}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({
      children,
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityHint,
    }: {
      children?: React.ReactNode;
      testID?: string;
      accessibilityRole?: string;
      accessibilityLabel?: string;
      accessibilityHint?: string;
    }) => (
      <div
        data-testid={testID}
        role={accessibilityRole}
        aria-label={accessibilityLabel}
        data-accessibility-hint={accessibilityHint}
      >
        {children}
      </div>
    ),
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#c5a46d',
      accentText: '#c5a46d',
      backgroundSecondary: '#111',
      divider: '#333',
      textPrimary: '#fff',
      textSecondary: '#aaa',
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
        'recording.preference.label': 'Mode',
        'recording.preference.text': 'Écrire',
        'recording.preference.voice': 'Raconter',
        'recording.onboarding.preference.settings_hint':
          'You can switch between Write and Tell anytime; the text stays the same.',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RecordingInputModeSelect', () => {
  it('shows both capture paths without opening a menu', () => {
    const onChange = jest.fn();

    render(<RecordingInputModeSelect value="text" onChange={onChange} />);

    expect(screen.getByTestId(TID.Button.InputModeSelect)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.InputModeText)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.InputModeVoice)).toBeTruthy();
    expect(screen.getByText('Écrire')).toBeTruthy();
    expect(screen.getByText('Raconter')).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingInputMode('text'))).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingInputMode('voice'))).toBeTruthy();
    expect(screen.queryByTestId('icon.line.3.horizontal')).toBeNull();
    expect(screen.queryByTestId(TID.Button.InputModeDismiss)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId(TID.Button.InputModeSelect).getAttribute('role')).toBe('tablist');
    expect(screen.getByTestId(TID.Button.InputModeSelect).getAttribute('aria-label')).toBe('Mode');
    expect(screen.getByTestId(TID.Button.InputModeSelect).getAttribute('data-accessibility-hint')).toBe(
      'You can switch between Write and Tell anytime; the text stays the same.'
    );
    expect(screen.getByTestId(TID.Button.InputModeText).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId(TID.Button.InputModeVoice).getAttribute('aria-selected')).toBe('false');
  });

  it('switches from write to tell without a hidden menu', () => {
    const onChange = jest.fn();

    render(<RecordingInputModeSelect value="text" onChange={onChange} />);

    fireEvent.click(screen.getByTestId(TID.Button.InputModeVoice));

    expect(onChange).toHaveBeenCalledWith('voice');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not emit a change when the current path is selected again', () => {
    const onChange = jest.fn();

    render(<RecordingInputModeSelect value="voice" onChange={onChange} />);

    fireEvent.click(screen.getByTestId(TID.Button.InputModeVoice));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps both paths visible while disabled and does not emit a change', () => {
    const onChange = jest.fn();

    render(<RecordingInputModeSelect value="voice" disabled onChange={onChange} />);

    expect(screen.getByText('Écrire')).toBeTruthy();
    expect(screen.getByText('Raconter')).toBeTruthy();
    expect((screen.getByTestId(TID.Button.InputModeText) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(TID.Button.InputModeVoice) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId(TID.Button.InputModeText));

    expect(onChange).not.toHaveBeenCalled();
  });
});
