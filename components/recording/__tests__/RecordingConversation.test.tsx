import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecordingConversation } from '../RecordingConversation';
import { TID } from '@/lib/testIDs';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  text: { primary: '#fff', secondary: '#aaa' }, surface: { raised: '#111' },
  accent: { text: '#ddd' }, action: { primary: '#ddd', primaryText: '#111' },
}) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/recording/MicButton', () => ({ MicButton: () => null }));

function props() {
  return {
    transcript: 'Un jardin.', question: 'Que te revient-il de ce jardin ?', loading: false,
    unavailable: false, done: false, disabled: false, voiceSupported: true,
    voiceStatus: 'idle' as const, onVoice: jest.fn(), onReview: jest.fn(),
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
