/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TID } from '@/lib/testIDs';

let mockHydrated = false;
let mockRestore: (value: string) => void;
let mockPartial: (value: string) => void;
const mockNoteInput = jest.fn((_value: string) => mockHydrated);
const mockClear = jest.fn();
const mockRetryHydration = jest.fn();
const mockStart = jest.fn(async () => ({ success: true }));
const mockAddDream = jest.fn(async (dream: object) => ({ ...dream, id: 42 }));
const mockBack = jest.fn();
const mockRecordingRef = { current: false };

jest.mock('react-native', () => {
  const React = require('react');
  const Box = React.forwardRef(({ children, testID, accessibilityState }: any, ref: any) => (
    <div ref={ref} data-testid={testID} aria-busy={accessibilityState?.busy}>{children}</div>
  ));
  const Input = React.forwardRef(({ value, onChangeText, editable, testID }: any, ref: any) => (
    <textarea ref={ref} value={value} disabled={!editable} data-testid={testID}
      onChange={(event) => onChangeText(event.target.value)} />
  ));
  Box.displayName = 'MockNativeContainer';
  Input.displayName = 'MockNativeTextInput';
  return {
    Platform: { OS: 'web', select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles, flatten: (style: any) => style, absoluteFill: {} },
    Alert: { alert: jest.fn() },
    AppState: { addEventListener: () => ({ remove: jest.fn() }) },
    Keyboard: { addListener: () => ({ remove: jest.fn() }), dismiss: jest.fn() },
    Text: ({ children }: any) => <span>{children}</span>,
    View: Box,
    ScrollView: Box,
    KeyboardAvoidingView: Box,
    TextInput: Input,
    Pressable: ({ children, onPress, disabled, testID, accessibilityLabel }: any) => (
      <button type="button" onClick={onPress} disabled={disabled} data-testid={testID}
        aria-label={accessibilityLabel}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    useWindowDimensions: () => ({ width: 1024, height: 844, scale: 1, fontScale: 1 }),
  };
});
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: mockBack, replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ mode: 'voice' }),
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useRecordingDraftPersistence', () => ({
  useRecordingDraftPersistence: ({ onRestore }: { onRestore: (value: string) => void }) => {
    mockRestore = onRestore;
    return { isHydrated: mockHydrated, hydrationStatus: mockHydrated ? 'ready' : 'loading',
      retryHydration: mockRetryHydration, noteInput: mockNoteInput,
      clearAfterSuccessfulSave: mockClear, lastPersistedValue: '' };
  },
}));
jest.mock('@/hooks/useRecordingSession', () => ({
  useRecordingSession: ({ onPartialTranscript }: { onPartialTranscript: (value: string) => void }) => {
    mockPartial = onPartialTranscript;
    return { isRecording: false, isRecordingRef: mockRecordingRef,
      recordingPermissionState: 'unknown', startRecording: mockStart,
      stopRecording: jest.fn(async () => ({ transcript: '' })), forceStopRecording: jest.fn() };
  },
}));
jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({ addDream: mockAddDream, applyDreamCategorization: jest.fn(), dreams: [] }),
}));
jest.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({ scope: 'guest', state: { pendingRecordingIntent: null }, transition: jest.fn() }),
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'dark', shadows: { xl: {} }, colors: {
    backgroundCard: '#221b3b', backgroundDark: '#0b0a12', backgroundSecondary: '#2f274f',
    textPrimary: '#fff', textSecondary: '#ccc', textTertiary: '#aaa', accent: '#6f62b5',
  } }),
}));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
jest.mock('@/lib/moti', () => ({ MotiView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
jest.mock('@/lib/analytics', () => ({
  trackProductEvent: jest.fn(async () => {}), getRecordingDurationBucket: () => 'none',
  getTranscriptLengthBucket: () => 'short',
}));
jest.mock('@/lib/logger', () => ({ createScopedLogger: () => ({ debug: jest.fn(), error: jest.fn(), warn: jest.fn() }) }));
jest.mock('@/services/geminiService', () => ({ categorizeDream: jest.fn(async () => ({})) }));
jest.mock('@/services/nativeSpeechRecognition', () => ({
  registerOfflineModelPromptHandler: () => () => {},
  resolveDeviceSpeechCapability: jest.fn(), shouldRestartHandsFreeSpeech: () => false,
}));
jest.mock('@/services/storageService', () => ({
  getRecordingInputModePreference: jest.fn(async () => 'voice'),
  getRecordingVoiceHintCompleted: jest.fn(async () => true),
  saveRecordingInputModePreference: jest.fn(async () => {}),
  saveRecordingVoiceHintCompleted: jest.fn(async () => {}),
}));
jest.mock('@/components/dev/MockNavigationRail', () => ({ MockNavigationRail: () => null }));
jest.mock('@/components/navigation/NoctaliaBottomNav', () => ({ NoctaliaBottomNav: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/recording/AtmosphereBackground', () => ({ AtmosphereBackground: () => null }));
jest.mock('@/components/recording/OfflineModelDownloadSheet', () => ({ OfflineModelDownloadSheet: () => null }));
jest.mock('@/components/recording/RememberedDreamProfileChips', () => ({ RememberedDreamProfileChips: () => null }));
jest.mock('@/components/recording/RecordingDraftProgress', () => ({ RecordingDraftProgress: () => null }));
jest.mock('@/components/Toast', () => ({ Toast: () => null }));
jest.mock('@/components/ui/StandardBottomSheet', () => ({ StandardBottomSheet: () => null }));
jest.mock('@/components/recording/RecordingSheets', () => ({
  MicPermissionRationaleSheet: ({ visible, onAllow }: { visible: boolean; onAllow: () => void }) =>
    visible ? <button data-testid="allow-microphone" onClick={onAllow}>Allow</button> : null,
}));

const { default: RecordingScreen } = require('@/app/recording');

describe('Recording draft hydration boundary', () => {
  beforeEach(() => {
    mockHydrated = false;
    mockRecordingRef.current = false;
    jest.clearAllMocks();
    mockNoteInput.mockImplementation(() => mockHydrated);
  });
  afterEach(cleanup);

  it('disables real editor, mode, microphone and save controls until restore completes, but permits exit', async () => {
    const view = render(<RecordingScreen />);
    await act(async () => {});
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('true');
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId(TID.Button.SaveDream) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(TID.Button.InputModeText) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(TID.Button.InputModeVoice) as HTMLButtonElement).disabled).toBe(true);
    const voice = screen.getByRole('button', { name: 'recording.mode.switch_to_voice' });
    expect((voice as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(voice);
    fireEvent.click(screen.getByTestId(TID.Button.SaveDream));
    act(() => mockPartial('early voice must not replace the stored draft'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(screen.queryByTestId('allow-microphone')).toBeNull();
    expect(mockAddDream).not.toHaveBeenCalled();
    expect(mockNoteInput).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(TID.Button.RecordingHome));
    expect(mockBack).toHaveBeenCalledTimes(1);

    act(() => {
      mockRestore('My durable dream');
      mockHydrated = true;
      view.rerender(<RecordingScreen />);
    });
    const input = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    expect(input.value).toBe('My durable dream');
    expect(input.disabled).toBe(false);
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('false');
    fireEvent.change(input, { target: { value: 'My durable dream with a new detail' } });
    expect(input.value).toBe('My durable dream with a new detail');
    expect(mockNoteInput).toHaveBeenLastCalledWith('My durable dream with a new detail');
    expect(mockStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(TID.Button.RecordToggle));
    expect(screen.getByTestId('allow-microphone')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByTestId('allow-microphone')));
    expect(mockStart).toHaveBeenCalledWith('My durable dream with a new detail');
  });

  it('keeps restored text when a mutation is refused, and only clears after readiness', async () => {
    const view = render(<RecordingScreen />);
    await act(async () => {});
    act(() => mockRestore('Restored before hydration completes'));
    const input = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    const clear = screen.getByTestId(TID.Button.ClearDream);
    expect((clear as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(clear);
    expect(input.value).toBe('Restored before hydration completes');
    expect(mockNoteInput).not.toHaveBeenCalled();
    act(() => { mockHydrated = true; view.rerender(<RecordingScreen />); });
    mockNoteInput.mockReturnValue(false);
    fireEvent.change(input, { target: { value: 'refused input' } });
    fireEvent.click(clear);
    act(() => mockPartial('refused speech'));
    expect(input.value).toBe('Restored before hydration completes');
    mockNoteInput.mockReturnValue(true);
    fireEvent.click(clear);
    expect(input.value).toBe('');
    expect(mockNoteInput).toHaveBeenLastCalledWith('');
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('saves the restored and subsequently edited dream only after hydration', async () => {
    const view = render(<RecordingScreen />);
    await act(async () => {});
    act(() => mockRestore('The original persisted dream'));
    fireEvent.click(screen.getByTestId(TID.Button.SaveDream));
    expect(mockAddDream).not.toHaveBeenCalled();
    act(() => { mockHydrated = true; view.rerender(<RecordingScreen />); });
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'The original persisted dream and the remembered ending' },
    });
    await act(async () => fireEvent.click(screen.getByTestId(TID.Button.SaveDream)));
    expect(mockAddDream).toHaveBeenCalledWith(expect.objectContaining({
      transcript: 'The original persisted dream and the remembered ending',
    }));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
