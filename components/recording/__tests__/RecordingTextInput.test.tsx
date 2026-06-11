/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  const MockTextInput = React.forwardRef(
    (
      {
        editable = true,
        onBlur,
        onChangeText,
        onFocus,
        placeholder,
        testID,
        value,
      }: {
        editable?: boolean;
        onBlur?: () => void;
        onChangeText?: (value: string) => void;
        onFocus?: () => void;
        placeholder?: string;
        testID?: string;
        value?: string;
      },
      ref: React.Ref<HTMLTextAreaElement>
    ) => (
      <textarea
        ref={ref}
        data-testid={testID}
        disabled={!editable}
        placeholder={placeholder}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChangeText?.(event.currentTarget.value)}
        onFocus={onFocus}
      />
    )
  );
  MockTextInput.displayName = 'MockTextInput';

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
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    TextInput: MockTextInput,
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/components/recording/MicButton', () => ({
  MicButton: ({
    accessibilityLabel,
    onPress,
    size,
    status,
  }: {
    accessibilityLabel?: string;
    onPress?: () => void;
    size?: string;
    status?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-testid="compact-mic"
      data-size={size}
      data-status={status}
      onClick={onPress}
    />
  ),
}));

jest.mock('@/components/recording/RecordingDraftProgress', () => ({
  RecordingDraftProgress: ({ value }: { value: string }) => (
    <div data-testid="draft">{value ? 'Good start' : '0/600'}</div>
  ),
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
      accentLight: '#e3c592',
      textPrimary: '#fff',
      textSecondary: '#aaa',
    },
    shadows: {
      md: {},
    },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    lora: { regularItalic: 'Lora-Italic' },
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
        'recording.placeholder': 'Tell your dream...',
        'recording.placeholder.accessibility': 'Dream transcript input',
        'recording.mode.switch_to_voice': 'Dictate the dream',
        'recording.mode.voice_cta_detail': 'The mic starts only after you allow it.',
        'recording.mode.voice_pause_detail': 'Dictation is running. Edit the text, pause, or save.',
        'recording.mode.voice_resume_detail': 'Resume dictation to add a scene, image, or emotion.',
        'recording.mode.clear_dream': 'Clear dream',
        'recording.mic.pause': 'Pause dictation',
        'recording.mic.pause_hint': 'Double tap to pause dictation',
      };
      return values[key] ?? key;
    },
  }),
}));

describe('RecordingTextInput', () => {
  it('shows a calm text box and compact microphone action', () => {
    const onSwitchToVoice = jest.fn();

    render(
      <RecordingTextInput
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        onSwitchToVoice={onSwitchToVoice}
      />
    );

    expect(screen.getByText('Write what you remember')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
    expect(screen.getByTestId('icon.pencil')).toBeTruthy();
    expect(screen.getByText('Dictate the dream')).toBeTruthy();
    expect(screen.getByText('The mic starts only after you allow it.')).toBeTruthy();
    expect(screen.getByTestId('compact-mic')).toBeTruthy();
    expect(screen.getByText('0/600')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.SwitchToVoice));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('keeps typed text editable and surfaces clear when there is content', () => {
    const onChange = jest.fn();
    const onClear = jest.fn();

    render(
      <RecordingTextInput
        value="A blue room"
        onChange={onChange}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        onSwitchToVoice={jest.fn()}
        onClear={onClear}
      />
    );

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room with rain' },
    });
    fireEvent.click(screen.getByTestId(TID.Button.ClearDream));

    expect(screen.queryByTestId('icon.pencil')).toBeNull();
    expect(screen.getByText('Good start')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('A blue room with rain');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('keeps the same composer available while dictation is active', () => {
    const onSwitchToVoice = jest.fn();

    render(
      <RecordingTextInput
        value="A blue room"
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        switchToVoiceLabel="Pause dictation"
        voiceCtaDetail="Dictation is running. Edit the text, pause, or save."
        voiceStatus="recording"
        recordingDurationLabel="0:38"
        onSwitchToVoice={onSwitchToVoice}
        onClear={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Input.DreamTranscript)).toBeTruthy();
    expect(screen.getByText('Pause dictation')).toBeTruthy();
    expect(screen.getByText('Dictation is running. Edit the text, pause, or save.')).toBeTruthy();
    expect(screen.getByTestId(TID.Text.RecordingVoiceStatusDuration).textContent).toBe('0:38');
    expect(screen.getByTestId('compact-mic').getAttribute('data-status')).toBe('recording');

    fireEvent.click(screen.getByTestId(TID.Button.SwitchToVoice));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('can prioritize the expressive microphone above the text box', () => {
    const onSwitchToVoice = jest.fn();

    render(
      <RecordingTextInput
        layout="voiceFirst"
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        switchToVoiceLabel="Dictate the dream"
        voiceCtaDetail="The text stays editable below."
        onSwitchToVoice={onSwitchToVoice}
      />
    );

    expect(screen.getByText('Dictate your dream')).toBeTruthy();
    expect(screen.getByTestId('compact-mic').getAttribute('data-size')).toBe('expressive');
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
    expect(screen.queryByText('Dictate the dream')).toBeNull();
    expect(screen.queryByText('The text stays editable below.')).toBeNull();

    fireEvent.click(screen.getByTestId('compact-mic'));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });
});
