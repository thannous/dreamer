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
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
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
});
