import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RecordingConversation } from '../RecordingConversation';
import { TID } from '@/lib/testIDs';

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  __esModule: true,
  default: { dismiss: jest.fn() },
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  text: { primary: '#fff', secondary: '#aaa' }, surface: { raised: '#111', border: '#444' },
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
    transcript: 'Un jardin.', answer: '', storyTranscript: 'Un jardin.', question: 'Que te revient-il de ce jardin ?', loading: false,
    unavailable: false, done: false, disabled: false, voiceSupported: true,
    voiceStatus: 'idle' as const, onVoice: jest.fn(), onMute: jest.fn(async () => {}), onReview: jest.fn(), onRestart: jest.fn(),
    onAnswerChange: jest.fn(), onAnswerSubmit: jest.fn(), onDirection: jest.fn(),
  };
}

it('keeps permission preparation distinct from an actually listening microphone', async () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} voiceStatus="preparing" />);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  expect(view.queryByText('recording.conversation.listening')).toBeNull();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByText('recording.conversation.listening')).toBeTruthy();
  expect(view.getByTestId('recording-conversation-question').props.children).toBe(callbacks.question);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  await waitFor(() => expect(callbacks.onMute).toHaveBeenCalledTimes(1));
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
});

it('persists typed answers on change and explicitly submits before the next question', async () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-conversation-submit'));
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('recording-conversation-answer'), 'Une porte ouverte.');
  expect(callbacks.onAnswerChange).toHaveBeenLastCalledWith('Une porte ouverte.');
  view.rerender(<RecordingConversation {...callbacks} answer="Une porte ouverte." />);
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(view.getByTestId('recording-conversation-submit'));
  });
  expect(callbacks.onAnswerSubmit).toHaveBeenCalledTimes(1);
  view.rerender(<RecordingConversation {...callbacks} answer="" />);
  await waitFor(() => expect(view.getByTestId('recording-conversation-answer').props.value).toBe(''));
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
  view.rerender(<RecordingConversation {...callbacks} loading />);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} voiceSupported={false} />);
  expect(view.queryByTestId(TID.Button.RecordToggle)).toBeNull();
});


it('offers writing and mute while listening without submitting the answer', async () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  await waitFor(() => expect(callbacks.onMute).toHaveBeenCalledTimes(1));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="idle" />);
  await waitFor(() => expect(view.getByTestId('recording-conversation-answer').props.editable).toBe(true));
  await waitFor(() => expect(view.getByTestId('recording-conversation-answer')).toBeTruthy());
  expect(callbacks.onMute).toHaveBeenCalledTimes(1);
});


it('lets the whole story card open manual editing and keeps completion separate from mute', async () => {
  const callbacks = { ...props(), answer: 'Une porte.' };
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-voice-preview'));
  expect(callbacks.onReview).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByTestId('recording-conversation-submit'));
  await waitFor(() => expect(callbacks.onAnswerSubmit).toHaveBeenCalledTimes(1));
  expect(callbacks.onMute).not.toHaveBeenCalled();
  expect(callbacks.onVoice).not.toHaveBeenCalled();
});


it('prefills the reply editor with dictation and keeps the completed story separate', async () => {
  const callbacks = { ...props(), answer: 'Une porte ouverte.', transcript: 'Un jardin. Une porte ouverte.' };
  const view = render(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByTestId('recording-conversation-answer').props.value).toBe('Une porte ouverte.');
  expect(view.getByTestId('recording-conversation-answer').props.editable).toBe(false);
  expect(view.getByTestId('recording-voice-preview').props.children).toBe('Un jardin.');
  fireEvent.press(view.getByTestId(TID.Button.RecordToggle));
  await waitFor(() => expect(callbacks.onMute).toHaveBeenCalledTimes(1));
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="idle" />);
  await waitFor(() => expect(view.getByTestId('recording-conversation-answer').props.editable).toBe(true));
  expect(view.getByTestId('recording-conversation-answer').props.value).toBe('Une porte ouverte.');
  fireEvent.changeText(view.getByTestId('recording-conversation-answer'), 'Une porte bleue.');
  expect(callbacks.onAnswerChange).toHaveBeenLastCalledWith('Une porte bleue.');
});


it('keeps the inline finish action available during dictation without making the transcript editable', async () => {
  const callbacks = { ...props(), answer: 'Une porte.' };
  const view = render(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByTestId('recording-conversation-answer').props.editable).toBe(false);
  expect(view.getAllByTestId(TID.Button.RecordToggle)).toHaveLength(1);
  fireEvent.press(view.getByTestId('recording-conversation-submit'));
  await waitFor(() => expect(callbacks.onAnswerSubmit).toHaveBeenCalledTimes(1));
  expect(callbacks.onVoice).not.toHaveBeenCalled();
});

it('keeps the opening prompt stable while the first dictated answer grows', () => {
  const callbacks = { ...props(), question: null, storyTranscript: '', transcript: '', answer: '' };
  const view = render(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.getByTestId('recording-conversation-question').props.children).toBe('recording.conversation.welcome');
  view.rerender(<RecordingConversation {...callbacks} transcript="Un jardin." answer="Un jardin." voiceStatus="recording" />);
  expect(view.getByTestId('recording-conversation-question').props.children).toBe('recording.conversation.welcome');
  expect(view.getByTestId('recording-listening-status')).toBeTruthy();
  view.rerender(<RecordingConversation {...callbacks} transcript="Un jardin." answer="Un jardin." voiceStatus="idle" />);
  expect(view.queryByTestId('recording-listening-status')).toBeNull();
  expect(view.getByTestId('recording-conversation-question').props.children).toBe('recording.conversation.welcome');
});

it('offers restarting for existing content and hides it for an empty story', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-conversation-restart'));
  expect(callbacks.onRestart).toHaveBeenCalledTimes(1);
  expect(callbacks.onReview).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} disabled />);
  expect(view.getByTestId('recording-conversation-restart')).toBeDisabled();
  view.rerender(<RecordingConversation {...callbacks} transcript="" storyTranscript="" />);
  expect(view.queryByTestId('recording-conversation-restart')).toBeNull();
});


it('keeps native sizing text in sync with disabled dictation and subsequent edits', () => {
  const callbacks = { ...props(), answer: 'Une plage.', voiceStatus: 'recording' as const };
  const view = render(<RecordingConversation {...callbacks} />);
  const input = () => view.getByTestId('recording-conversation-answer');
  const measurement = () => view.getByTestId('recording-conversation-answer-measurement', { includeHiddenElements: true });
  expect(input().props.editable).toBe(false);
  view.rerender(<RecordingConversation {...callbacks} answer="Une plage. Des vagues, des rochers et un chemin qui longe la mer." />);
  expect(measurement().props.children).toBe(input().props.value);
  expect(view.queryByTestId('recording-conversation-answer-measurement')).toBeNull();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="idle" answer="Une plage." />);
  expect(measurement().props.children).toBe('Une plage.');
  expect(input().props.editable).toBe(true);
});


it('shows an empty answer field immediately without opening the keyboard', () => {
  const view = render(<RecordingConversation {...props()} transcript="" storyTranscript="" question={null} />);
  expect(view.getByTestId('recording-conversation-answer').props.editable).toBe(true);
  expect(view.getByTestId('recording-conversation-answer').props.autoFocus).toBe(false);
  expect(view.getByTestId('recording-conversation-submit')).toBeDisabled();
  expect(view.queryByTestId('recording-conversation-type')).toBeNull();
  expect(view.queryByTestId('recording-direction-place')).toBeNull();
});

it('offers optional directions only before answering and never submits a suggested dream detail', () => {
  const callbacks = props();
  const view = render(<RecordingConversation {...callbacks} />);
  fireEvent.press(view.getByTestId('recording-direction-place'));
  expect(callbacks.onDirection).toHaveBeenCalledWith('place');
  expect(callbacks.onAnswerSubmit).not.toHaveBeenCalled();
  expect(callbacks.onAnswerChange).not.toHaveBeenCalled();
  view.rerender(<RecordingConversation {...callbacks} answer="Du sable." />);
  expect(view.queryByTestId('recording-direction-done')).toBeNull();
  view.rerender(<RecordingConversation {...callbacks} voiceStatus="recording" />);
  expect(view.queryByTestId('recording-direction-place')).toBeNull();
});
