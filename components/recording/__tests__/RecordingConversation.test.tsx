import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RecordingConversation } from '../RecordingConversation';
import { TID } from '@/lib/testIDs';

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  __esModule: true,
  default: { dismiss: jest.fn() },
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  text: { primary: '#fff', secondary: '#aaa' }, surface: { raised: '#111' },
  accent: { text: '#ddd' }, action: { primary: '#ddd', primaryText: '#111' },
}) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/recording/MicButton', () => {
  const { Pressable } = require('react-native');
  return {
    MicButton: ({ onPress, interaction, testID, accessibilityLabel }: {
      onPress: () => void; interaction: string; testID: string; accessibilityLabel: string;
    }) => <Pressable onPress={onPress} disabled={interaction === 'disabled'} testID={testID} accessibilityLabel={accessibilityLabel} />,
  };
});

function props() {
  return {
    transcript: 'Un jardin.', question: 'Que te revient-il de ce jardin ?', loading: false,
    unavailable: false, done: false, disabled: false, voiceSupported: true,
    voiceStatus: 'idle' as const, onVoice: jest.fn(), onMute: jest.fn(async () => {}), onReview: jest.fn(),
    onAnswerChange: jest.fn(), onAnswerSubmit: jest.fn(),
  };
}

it('keeps permission preparation distinct from an actually listening microphone', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} voiceStatus="preparing" />);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  expect(view.queryByText('recording.conversation.listening')).toBeNull();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByText('recording.conversation.listening')).toBeTruthy();
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).toHaveBeenCalledTimes(1);
});

it('persists typed answers on change and explicitly submits before the next question', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-conversation-type'));
  fireEvent.press(view.getByTestId('recording-conversation-submit'));
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('recording-conversation-answer'), 'Une porte ouverte.');
  expect(callbacks.onAnswerChange).toHaveBeenLastCalledWith('Une porte ouverte.');
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('recording-conversation-submit'));
  expect(callbacks.onAnswerSubmit).toHaveBeenCalledTimes(1);
  expect(view.queryByTestId('recording-conversation-answer')).toBeNull();
});

it('allows review after completion and presents fallback questions as general', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} unavailable />);
  expect(view.getByText('recording.conversation.offline')).toBeTruthy();
  view.rerender(<RecordingConversation {...callbacks} done />);
  expect(view.queryByTestId(TID.Button.RecordToggle)).toBeNull();
  fireEvent.press(view.getByTestId('recording-review-transcript'));
  expect(callbacks.onReview).toHaveBeenCalledTimes(1);
});

it('starts dictation from the reply editor without clearing the persisted typed answer', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-conversation-type'));
  fireEvent.changeText(view.getByTestId('recording-conversation-answer'), 'Une porte ouverte.');
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).toHaveBeenCalledTimes(1);
  expect(callbacks.onAnswerChange).toHaveBeenCalledTimes(1);
  expect(callbacks.onAnswerChange).toHaveBeenLastCalledWith('Une porte ouverte.');
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByText('recording.conversation.listening')).toBeTruthy();
});

it('disables reply dictation while busy and hides it when speech is unsupported', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-conversation-type'));
  view.rerender(<RecordingConversation {...callbacks} loading />);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} voiceSupported={false} />);
  expect(view.queryByTestId(TID.Button.RecordToggle)).toBeNull();
});


it('offers writing and mute while listening without submitting the answer', async () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  fireEvent.press(view.getByTestId('recording-conversation-mute'));
  await waitFor(() => expect(callbacks.onMute).toHaveBeenCalledTimes(1));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  await waitFor(() => expect(view.getByTestId('recording-conversation-type')).toBeEnabled());
  fireEvent.press(view.getByTestId('recording-conversation-type'));
  await waitFor(() => expect(view.getByTestId('recording-conversation-answer')).toBeTruthy());
  expect(callbacks.onMute).toHaveBeenCalledTimes(2);
});
