/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Composer } from '@/components/chat/Composer';

const mockAlert = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockSetupAppStateListener = jest.fn();
const mockForceStopRecording = jest.fn();
const mockAppStateCleanup = jest.fn();
const mockRegisterOfflineModelPromptHandler = jest.fn();
const mockBaseTranscriptRef = { current: '' };
let mockIsRecording = false;

jest.mock('react-native', () => {
  const React = require('react');
  const MockTextInput = React.forwardRef(
    (
      {
        editable = true,
        onChangeText,
        placeholder,
        testID,
        value,
      }: {
        editable?: boolean;
        onChangeText?: (value: string) => void;
        placeholder?: string;
        testID?: string;
        value?: string;
      },
      ref: React.Ref<HTMLInputElement>
    ) => (
      <input
        ref={ref}
        data-testid={testID}
        disabled={!editable}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChangeText?.(event.currentTarget.value)}
      />
    )
  );
  MockTextInput.displayName = 'MockTextInput';

  return {
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    StyleSheet: {
      absoluteFill: { position: 'absolute' },
      create: (styles: Record<string, unknown>) => styles,
    },
    TextInput: MockTextInput,
    View: React.forwardRef(function MockView(
      { children }: { children?: React.ReactNode },
      ref: React.ForwardedRef<HTMLDivElement>
    ) {
      return <div ref={ref}>{children}</div>;
    }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      disabled,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        aria-disabled={accessibilityState?.disabled}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
  };
});

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/components/speech/LanguagePackMissingSheet', () => ({
  LanguagePackMissingSheet: () => null,
}));

jest.mock('@/components/recording/OfflineModelDownloadSheet', () => ({
  OfflineModelDownloadSheet: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: {
      disabled: '#333',
      disabledBorder: '#444',
      primary: '#765',
      primaryBorder: '#876',
      primaryText: '#fff',
    },
    surface: {
      border: '#333',
      raised: '#111',
      soft: '#222',
    },
    text: {
      primary: '#fff',
      secondary: '#aaa',
    },
  }),
}));

jest.mock('@/context/ChatContext', () => ({
  useComposerHeightContext: () => ({
    composerHeight: { get: () => 0, set: jest.fn() },
  }),
  useKeyboardStateContext: () => ({
    keyboardHeight: { get: () => 0, set: jest.fn() },
  }),
}));

jest.mock('@/context/ScrollPerfContext', () => ({
  useScrollPerf: () => false,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { backgroundCard: '#111' },
    mode: 'dark',
  }),
}));

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

jest.mock('@/hooks/useRecordingSession', () => ({
  useRecordingSession: () => ({
    isRecording: mockIsRecording,
    baseTranscriptRef: mockBaseTranscriptRef,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    setupAppStateListener: mockSetupAppStateListener,
    forceStopRecording: mockForceStopRecording,
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/services/nativeSpeechRecognition', () => ({
  registerOfflineModelPromptHandler: (handler: unknown) =>
    mockRegisterOfflineModelPromptHandler(handler),
}));

jest.mock('@/lib/speechRecognitionSettings', () => ({
  openGoogleVoiceSettingsBestEffort: jest.fn(),
  openSpeechRecognitionLanguageSettings: jest.fn(),
}));

function renderComposer({
  isDisabled = false,
  isLoading = false,
  onChangeText = jest.fn(),
  onSend = jest.fn(),
  value = 'A blue room',
}: {
  isDisabled?: boolean;
  isLoading?: boolean;
  onChangeText?: jest.Mock;
  onSend?: jest.Mock;
  value?: string;
} = {}) {
  render(
    <Composer.Root
      value={value}
      onChangeText={onChangeText}
      onSend={onSend}
      isDisabled={isDisabled}
      isLoading={isLoading}
      testID="composer-input"
      micTestID="composer-mic"
      sendTestID="composer-send"
    >
      <Composer.Body>
        <Composer.Input />
        <Composer.MicButton />
        <Composer.SendButton />
      </Composer.Body>
    </Composer.Root>
  );

  return { onChangeText, onSend };
}

describe('Composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRecording = false;
    mockBaseTranscriptRef.current = '';
    mockStartRecording.mockResolvedValue({ success: true });
    mockStopRecording.mockResolvedValue({});
    mockSetupAppStateListener.mockReturnValue(mockAppStateCleanup);
    mockRegisterOfflineModelPromptHandler.mockReturnValue(jest.fn());
  });

  afterEach(cleanup);

  it('disables editing, voice, and sending when the composer is disabled', () => {
    const { onChangeText, onSend } = renderComposer({ isDisabled: true });

    expect((screen.getByTestId('composer-input') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('composer-mic') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('composer-send') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('composer-mic'));
    fireEvent.click(screen.getByTestId('composer-send'));

    expect(onChangeText).not.toHaveBeenCalled();
    expect(mockStartRecording).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('forwards text edits and invokes send for a non-empty draft', () => {
    const { onChangeText, onSend } = renderComposer();

    fireEvent.change(screen.getByTestId('composer-input'), {
      target: { value: 'A blue room with rain' },
    });
    fireEvent.click(screen.getByTestId('composer-send'));

    expect(onChangeText).toHaveBeenCalledWith('A blue room with rain');
    expect(onSend).toHaveBeenCalledWith(undefined);
  });

  it('stops recording and sends the merged transcript only after stop resolves', async () => {
    mockIsRecording = true;
    mockBaseTranscriptRef.current = 'A blue room';
    let resolveStop: (() => void) | undefined;
    mockStopRecording.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStop = () => resolve({ transcript: 'with rain' });
        })
    );
    const { onChangeText, onSend } = renderComposer();

    fireEvent.click(screen.getByTestId('composer-send'));

    await waitFor(() => expect(mockStopRecording).toHaveBeenCalledTimes(1));
    expect(onSend).not.toHaveBeenCalled();

    await act(async () => {
      resolveStop?.();
    });

    await waitFor(() => {
      expect(onChangeText).toHaveBeenCalledWith('A blue room with rain');
      expect(onSend).toHaveBeenCalledWith('A blue room with rain');
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('alerts when voice recording cannot start', async () => {
    mockStartRecording.mockResolvedValue({ success: false, error: 'permission_denied' });
    renderComposer();

    fireEvent.click(screen.getByTestId('composer-mic'));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledWith('A blue room');
      expect(mockAlert).toHaveBeenCalledWith(
        'common.error_title',
        'recording.alert.start_failed'
      );
    });
  });
});
