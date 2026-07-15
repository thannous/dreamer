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

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="inline-action-fade">{children}</div>
  ),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: '#171322',
      backgroundSecondary: '#111',
      divider: '#333',
      accent: '#c5a46d',
      accentLight: '#e3c592',
      textPrimary: '#fff',
      textSecondary: '#aaa',
    },
    mode: 'dark',
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
    t: (key: string, params?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        'recording.placeholder': 'Tell your dream...',
        'recording.placeholder.accessibility': 'Dream transcript input',
        'recording.mode.switch_to_voice': 'Dictate the dream',
        'recording.mode.voice_cta_detail': 'The mic starts only after you allow it.',
        'recording.mode.voice_pause_detail': 'Dictation is running. Edit the text, pause, or save.',
        'recording.mode.voice_resume_detail': 'Resume dictation to add a scene, image, or emotion.',
        'recording.mode.clear_dream': 'Clear dream',
        'recording.onboarding.voice.body': 'Tap the mic to dictate your dream.',
        'recording.voice_hint.understood': 'Got it',
        'recording.guide.dismiss': 'Close guide',
        'recording.mic.pause': 'Pause dictation',
        'recording.mic.pause_hint': 'Double tap to pause dictation',
        'recording.activation_insight.eyebrow': 'First read',
        'recording.activation_insight.summary.memory': 'This memory is saved as a remembered dream.',
        'recording.activation_insight.summary.signals': 'Noctalia already notices: {signals}.',
        'recording.activation_insight.summary.fragment': 'This fragment is enough to start your profile.',
        'recording.activation_insight.signal.memory': 'Memory',
        'recording.activation_insight.signal.emotion': 'Emotion',
        'recording.activation_insight.signal.place': 'Place',
        'recording.activation_insight.signal.person': 'Person',
        'recording.activation_insight.signal.symbol': 'Symbol',
        'recording.activation_insight.signal.recurrence': 'Pattern',
      };
      let value = values[key] ?? key;
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(`{${paramKey}}`, String(paramValue));
        }
      }
      return value;
    },
  }),
}));

describe('RecordingTextInput', () => {
  it('prioritizes the editable transcript while keeping voice available in text mode', () => {
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
    expect(screen.queryByText('Dictate the dream')).toBeNull();
    expect(screen.getByTestId('compact-mic').getAttribute('data-size')).toBe('inline');

    fireEvent.click(screen.getByTestId('compact-mic'));

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
    expect(screen.getByTestId('icon.trash')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('A blue room with rain');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('reveals remembered-dream details only after the dream has started', () => {
    const onOpenDetails = jest.fn();

    const { rerender } = render(
      <RecordingTextInput
        layout="voiceFirst"
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Tell a remembered dream"
        onSwitchToVoice={jest.fn()}
        onOpenDetails={onOpenDetails}
      />
    );

    expect(screen.queryByTestId('icon.plus')).toBeNull();

    rerender(
      <RecordingTextInput
        layout="voiceFirst"
        value="A room under the sea"
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Tell a remembered dream"
        onSwitchToVoice={jest.fn()}
        onOpenDetails={onOpenDetails}
      />
    );

    expect(screen.getByTestId('icon.plus')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RememberedDreamMetadataToggle));

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('keeps the transcript editable while dictating in voice mode', () => {
    const onSwitchToVoice = jest.fn();
    const onChange = jest.fn();

    render(
      <RecordingTextInput
        layout="voiceFirst"
        value="A blue room"
        onChange={onChange}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        switchToVoiceLabel="Pause dictation"
        voiceStatus="recording"
        recordingDurationLabel="0:38"
        onSwitchToVoice={onSwitchToVoice}
        onClear={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Input.DreamTranscript)).toBeTruthy();
    expect(screen.getByDisplayValue('A blue room')).toBeTruthy();
    expect(screen.queryByText('Pause dictation')).toBeNull();
    expect(screen.getByTestId(TID.Text.RecordingVoiceStatusDuration).textContent).toBe('0:38');
    expect(screen.getByTestId('compact-mic').getAttribute('data-size')).toBe('expressive');
    expect(screen.getByTestId('compact-mic').getAttribute('data-status')).toBe('recording');

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room with rain' },
    });

    fireEvent.click(screen.getByTestId('compact-mic'));

    expect(onChange).toHaveBeenCalledWith('A blue room with rain');
    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('can prioritize the expressive microphone above the editable text box', () => {
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
        onSwitchToVoice={onSwitchToVoice}
      />
    );

    expect(screen.getByText('Dictate your dream')).toBeTruthy();
    expect(screen.getByTestId('compact-mic').getAttribute('data-size')).toBe('expressive');
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
    expect(screen.queryByText('Dictate the dream')).toBeNull();

    fireEvent.click(screen.getByTestId('compact-mic'));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('points first-time voice users to the microphone and can be dismissed', () => {
    const onVoiceHintDismiss = jest.fn();

    render(
      <RecordingTextInput
        layout="voiceFirst"
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        showVoiceHint
        onVoiceHintDismiss={onVoiceHintDismiss}
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Component.RecordingVoiceHint)).toBeTruthy();
    expect(screen.getByText('Tap the mic to dictate your dream.')).toBeTruthy();
    expect(screen.getByText('Got it')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.RecordingVoiceHintDismiss));

    expect(onVoiceHintDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps retry on the microphone without duplicating the retry label', () => {
    const onSwitchToVoice = jest.fn();

    render(
      <RecordingTextInput
        layout="voiceFirst"
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        switchToVoiceLabel="Retry voice"
        onSwitchToVoice={onSwitchToVoice}
      />
    );

    expect(screen.queryByText('Retry voice')).toBeNull();

    fireEvent.click(screen.getByTestId('compact-mic'));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });
});
