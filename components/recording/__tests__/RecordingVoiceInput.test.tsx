/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingVoiceInput } from '@/components/recording/RecordingVoiceInput';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    ActivityIndicator: ({ testID }: { testID?: string }) => <div data-testid={testID ?? 'activity'} />,
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
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/components/recording/MicButton', () => ({
  MicButton: ({ onPress, testID }: { onPress?: () => void; testID?: string }) => (
    <button data-testid={testID} onClick={onPress} />
  ),
}));

jest.mock('@/components/recording/RecordingDraftProgress', () => ({
  RecordingDraftProgress: ({ value }: { value: string }) => <div data-testid="draft">{value}</div>,
}));

jest.mock('@/components/ui/TypewriterText', () => ({
  TypewriterText: ({ text }: { text: string }) => <span>{text}</span>,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundSecondary: '#111',
      divider: '#333',
      accent: '#c5a46d',
      accentDark: '#8b6a3d',
      accentLight: '#e3c592',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      textOnAccentSurface: '#fff',
    },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    lora: { regular: 'Lora-Regular' },
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        'recording.status.hide': 'Hide',
        'recording.status.show': 'Show voice status',
        'recording.mode.switch_to_text': 'Switch to writing',
        'recording.mode.switch_to_text_hint': 'Type directly, correct, or add details after voice.',
        'recording.mode.switch_to_text_edit': 'Edit the dream text',
        'recording.mode.switch_to_text_edit_hint': 'Review and enrich the transcript before saving.',
      };
      return values[key] ?? key;
    },
  }),
}));

const baseProps = {
  transcript: '',
  instructionText: 'Speak your dream',
  interaction: 'enabled' as const,
  voiceStatusTitle: 'Voice ready',
  voiceStatusDetail: 'Tap the mic to record.',
  voiceStatusTone: 'neutral' as const,
  onToggleRecording: jest.fn(),
  onSwitchToText: jest.fn(),
  onHideVoiceStatus: jest.fn(),
  onShowVoiceStatus: jest.fn(),
};

describe('RecordingVoiceInput', () => {
  it('hides the ready voice status when the saved preference is hidden', () => {
    render(<RecordingVoiceInput {...baseProps} status="idle" voiceStatusHidden />);

    expect(screen.queryByTestId(TID.Component.RecordingVoiceStatus)).toBeNull();
    expect(screen.getByTestId(TID.Button.ShowRecordingVoiceStatus)).toBeTruthy();
  });

  it('keeps the voice status visible while recording even when the ready state is hidden', () => {
    render(
      <RecordingVoiceInput
        {...baseProps}
        status="recording"
        voiceStatusHidden
        voiceStatusTone="active"
        recordingDurationLabel="0:05"
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingVoiceStatus)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingVoiceStatusDuration).textContent).toBe('0:05');
  });

  it('calls the hide action from the ready status card', () => {
    const onHideVoiceStatus = jest.fn();

    render(
      <RecordingVoiceInput
        {...baseProps}
        status="idle"
        voiceStatusHidden={false}
        onHideVoiceStatus={onHideVoiceStatus}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.HideRecordingVoiceStatus));

    expect(onHideVoiceStatus).toHaveBeenCalledTimes(1);
  });

  it('shows a writing switch link at the voice input level', () => {
    const onSwitchToText = jest.fn();

    render(
      <RecordingVoiceInput
        {...baseProps}
        status="idle"
        voiceStatusHidden={false}
        onSwitchToText={onSwitchToText}
      />
    );

    expect(screen.getByText('Switch to writing')).toBeTruthy();
    expect(screen.getByTestId('icon.keyboard')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.SwitchToText));

    expect(onSwitchToText).toHaveBeenCalledTimes(1);
  });
});
