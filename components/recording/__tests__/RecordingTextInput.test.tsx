/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { TID } from '@/lib/testIDs';

let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;

jest.mock('react-native', () => {
  const React = require('react');
  const flattenStyle = (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
    }
    return style && typeof style === 'object' ? style as Record<string, unknown> : {};
  };
  const MockTextInput = React.forwardRef(
    (
      {
        editable = true,
        onBlur,
        onChangeText,
        onFocus,
        placeholder,
        style,
        testID,
        value,
      }: {
        editable?: boolean;
        onBlur?: () => void;
        onChangeText?: (value: string) => void;
        onFocus?: () => void;
        placeholder?: string;
        style?: unknown;
        testID?: string;
        value?: string;
      },
      ref: React.Ref<HTMLTextAreaElement>
    ) => (
      <textarea
        ref={ref}
        data-testid={testID}
        disabled={!editable}
        data-native-style={JSON.stringify(flattenStyle(style))}
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
    Platform: { OS: 'web' },
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
      flatten: flattenStyle,
    },
    Text: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => (
      <span data-native-style={JSON.stringify(flattenStyle(style))} data-testid={testID}>
        {children}
      </span>
    ),
    TextInput: MockTextInput,
    View: ({
      children,
      style,
      testID,
      nativeID,
      accessibilityLiveRegion,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
      nativeID?: string;
      accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
    }) => (
      <div
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-testid={testID}
        data-layout={nativeID}
        aria-live={
          accessibilityLiveRegion === 'polite' || accessibilityLiveRegion === 'assertive'
            ? accessibilityLiveRegion
            : 'off'
        }
      >
        {children}
      </div>
    ),
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

jest.mock('@/components/recording/MicButton', () => ({
  MicButton: ({
    accessibilityLabel,
    onPress,
    size,
    status,
    testID,
  }: {
    accessibilityLabel?: string;
    onPress?: () => void;
    size?: string;
    status?: string;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-testid={testID ?? 'compact-mic'}
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
      accentText: '#e3c592',
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
        'recording.status.preparing.title': 'Preparing microphone',
        'recording.status.recording.title': 'Recording',
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
  beforeEach(() => {
    mockWindowWidth = 390;
    mockWindowHeight = 844;
    mockFontScale = 1;
  });

  it('keeps write mode calm without an inline microphone', () => {
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
    expect(screen.queryByTestId(TID.Button.RecordToggle)).toBeNull();
    expect(onSwitchToVoice).not.toHaveBeenCalled();
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
    expect(screen.getByTestId(TID.Button.RecordToggle).getAttribute('data-size')).toBe('expressive');
    expect(screen.getByTestId(TID.Button.RecordToggle).getAttribute('data-status')).toBe('recording');
    expect(screen.getByTestId(TID.Text.RecordingVoiceStatusTitle).textContent).toBe('Recording');
    expect(screen.getByTestId(TID.Component.RecordingVoiceStatus).getAttribute('aria-live')).toBe('polite');

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room with rain' },
    });

    fireEvent.click(screen.getByTestId(TID.Button.RecordToggle));

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
    expect(screen.getByTestId(TID.Button.RecordToggle).getAttribute('data-size')).toBe('expressive');
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
    expect(screen.queryByText('Dictate the dream')).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.RecordToggle));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('hides the microphone entirely when the device cannot capture speech', () => {
    render(
      <RecordingTextInput
        layout="voiceFirst"
        voiceSupported={false}
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Type your dream"
        switchToVoiceLabel="Dictate the dream"
        onSwitchToVoice={jest.fn()}
      />
    );

    // The text editor must remain fully usable — blocking voice never blocks capture.
    expect(screen.queryByTestId(TID.Button.RecordToggle)).toBeNull();
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
  });

  it('hides the microphone in write mode even when speech is supported', () => {
    render(
      <RecordingTextInput
        layout="textFirst"
        voiceSupported
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Type your dream"
        switchToVoiceLabel="Dictate the dream"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.queryByTestId(TID.Button.RecordToggle)).toBeNull();
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
  });

  it('keeps write mode usable when speech is unsupported', () => {
    render(
      <RecordingTextInput
        layout="textFirst"
        voiceSupported={false}
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Type your dream"
        switchToVoiceLabel="Dictate the dream"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.queryByTestId(TID.Button.RecordToggle)).toBeNull();
    expect(screen.getByPlaceholderText('Tell your dream...')).toBeTruthy();
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

    fireEvent.click(screen.getByTestId(TID.Button.RecordToggle));

    expect(onSwitchToVoice).toHaveBeenCalledTimes(1);
  });

  it('places the expressive microphone above the editable transcript in tell mode', () => {
    render(
      <RecordingTextInput
        layout="voiceFirst"
        value="A blue room"
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        voiceStatus="recording"
        recordingDurationLabel="0:12"
        onSwitchToVoice={jest.fn()}
      />
    );

    const composer = screen.getByTestId('recording-composer');
    expect(composer.getAttribute('data-layout')).toBe('voiceFirst');

    const html = composer.innerHTML;
    expect(html.indexOf(TID.Button.RecordToggle)).toBeGreaterThanOrEqual(0);
    expect(html.indexOf(TID.Input.DreamTranscript)).toBeGreaterThan(
      html.indexOf(TID.Button.RecordToggle)
    );
    expect(html.indexOf(TID.Component.RecordingVoiceStatus)).toBeGreaterThan(
      html.indexOf(TID.Button.RecordToggle)
    );
    expect(html.indexOf(TID.Input.DreamTranscript)).toBeGreaterThan(
      html.indexOf(TID.Component.RecordingVoiceStatus)
    );
  });

  it('announces the preparing state without hiding the transcript', () => {
    render(
      <RecordingTextInput
        layout="voiceFirst"
        value="A remembered corridor"
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        voiceStatus="preparing"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.getByTestId(TID.Text.RecordingVoiceStatusTitle).textContent).toBe(
      'Preparing microphone'
    );
    expect(screen.getByDisplayValue('A remembered corridor')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.RecordToggle).getAttribute('data-status')).toBe('preparing');
  });

  it('keeps the same editable draft when switching Write and Tell layouts', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <RecordingTextInput
        layout="textFirst"
        value="A blue room under the rain"
        onChange={onChange}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
    expect(screen.getByDisplayValue('A blue room under the rain')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.RecordToggle)).toBeNull();

    rerender(
      <RecordingTextInput
        layout="voiceFirst"
        value="A blue room under the rain"
        onChange={onChange}
        disabled={false}
        lengthWarning=""
        instructionText="Dictate your dream"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('voiceFirst');
    expect(screen.getByDisplayValue('A blue room under the rain')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.RecordToggle)).toBeTruthy();
    expect(screen.getAllByTestId(TID.Input.DreamTranscript)).toHaveLength(1);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain and a red bicycle' },
    });
    expect(onChange).toHaveBeenCalledWith('A blue room under the rain and a red bicycle');
  });

  it.each([
    [1, 144],
    [1.3, 144],
    [2, 164],
  ])(
    'uses an adaptive compact-height editor at 320 dp with font scale %s',
    (fontScale: number, expectedMinHeight: number) => {
      mockWindowWidth = 320;
      mockWindowHeight = 640;
      mockFontScale = fontScale;

      render(
        <RecordingTextInput
          value=""
          onChange={jest.fn()}
          disabled={false}
          lengthWarning=""
          instructionText="Write what you remember"
          onSwitchToVoice={jest.fn()}
        />
      );

      const instructionStyle = screen.getByText('Write what you remember').getAttribute(
        'data-native-style'
      );
      const inputStyle = screen.getByTestId(TID.Input.DreamTranscript).getAttribute(
        'data-native-style'
      );

      expect(instructionStyle).toContain('"fontSize":21');
      expect(instructionStyle).toContain('"lineHeight":29');
      expect(inputStyle).toContain(`"minHeight":${expectedMinHeight}`);
      expect(inputStyle).toContain('"maxHeight":286');
    }
  );

  it('preserves the existing title and editor geometry above 360 dp', () => {
    render(
      <RecordingTextInput
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        onSwitchToVoice={jest.fn()}
      />
    );

    expect(screen.getByText('Write what you remember').getAttribute('data-native-style')).toContain(
      '"fontSize":23'
    );
    expect(screen.getByText('Write what you remember').getAttribute('data-native-style')).toContain(
      '"lineHeight":32'
    );
    expect(screen.getByTestId(TID.Input.DreamTranscript).getAttribute('data-native-style')).toContain(
      '"minHeight":196'
    );
  });

  it('preserves the existing short-landscape compact geometry', () => {
    mockWindowWidth = 640;
    mockWindowHeight = 320;

    render(
      <RecordingTextInput
        compact
        value=""
        onChange={jest.fn()}
        disabled={false}
        lengthWarning=""
        instructionText="Write what you remember"
        onSwitchToVoice={jest.fn()}
      />
    );

    const instructionStyle = screen.getByText('Write what you remember').getAttribute(
      'data-native-style'
    );
    const inputStyle = screen.getByTestId(TID.Input.DreamTranscript).getAttribute(
      'data-native-style'
    );

    expect(instructionStyle).toContain('"fontSize":18');
    expect(instructionStyle).toContain('"lineHeight":24');
    expect(inputStyle).toContain('"minHeight":96');
    expect(inputStyle).toContain('"maxHeight":112');
  });
});
