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
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#c5a46d',
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
        'recording.preference.view_title': 'Vue de capture',
        'recording.preference.text': 'Écrit',
        'recording.preference.voice': 'Vocal',
        'recording.preference.selected': 'Vue actuelle',
        'recording.preference.text_hint': 'Si tu préfères écrire ton rêve.',
        'recording.preference.voice_hint': 'Si tu préfères le dicter à voix haute.',
        'recording.preference.accessibility': 'Ouvrir les réglages de capture',
        'recording.preference.dismiss_accessibility': 'Fermer les réglages de capture',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RecordingInputModeSelect', () => {
  it('opens the preference menu and selects voice mode', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();
    const onOptionSelected = jest.fn();

    render(
      <RecordingInputModeSelect
        value="text"
        onOpenChange={onOpenChange}
        onOptionSelected={onOptionSelected}
        onChange={onChange}
      />
    );

    expect(screen.queryByText('Vue de capture')).toBeNull();
    expect(screen.queryByText('Mode')).toBeNull();
    expect(screen.queryByText('Écrit')).toBeNull();
    expect(screen.getByTestId('icon.line.3.horizontal')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.InputModeSelect));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Vue de capture')).toBeTruthy();
    expect(screen.getByText('Écrit')).toBeTruthy();
    expect(screen.getByText('Si tu préfères écrire ton rêve.')).toBeTruthy();
    expect(screen.getByText('Si tu préfères le dicter à voix haute.')).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.InputModeVoice));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onOptionSelected).toHaveBeenCalledWith('voice');
    expect(onChange).toHaveBeenCalledWith('voice');
  });

  it('closes the preference menu when pressing outside of it', () => {
    const onChange = jest.fn();

    render(
      <RecordingInputModeSelect
        value="text"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.InputModeSelect));
    expect(screen.getByText('Vue de capture')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.InputModeDismiss));

    expect(screen.queryByText('Vue de capture')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
