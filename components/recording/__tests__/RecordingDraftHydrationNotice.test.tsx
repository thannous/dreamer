import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { RecordingDraftHydrationNotice } from '../RecordingDraftHydrationNotice';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { primary: '#fff' },
    surface: { raised: '#222', soft: '#333', border: '#444' },
  }),
}));

const messages = {
  loading: 'Restoring your draft…',
  error: 'Your draft could not be restored.',
  retry: 'Try again',
};

describe('RecordingDraftHydrationNotice', () => {
  it('announces a selectable error and provides a reachable retry action', () => {
    const onRetry = jest.fn();
    const { getByText, getByRole } = render(
      <RecordingDraftHydrationNotice hydrationStatus="error" onRetry={onRetry} messages={messages} />
    );
    const message = getByText(messages.error);
    expect(message.props.selectable).toBe(true);
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    const retry = getByRole('button', { name: messages.retry });
    expect(retry.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(StyleSheet.flatten(retry.props.style)).toMatchObject({ minHeight: 44, minWidth: 44 });
    fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('blocks retry during loading and disappears when restoration is ready', () => {
    const onRetry = jest.fn();
    const { getByText, getByRole, queryByText, queryByRole, rerender } = render(
      <RecordingDraftHydrationNotice hydrationStatus="loading" onRetry={onRetry} messages={messages} />
    );
    expect(getByText(messages.loading).props.accessibilityLiveRegion).toBe('polite');
    const retry = getByRole('button', { name: messages.retry });
    expect(retry.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(retry);
    expect(onRetry).not.toHaveBeenCalled();
    rerender(<RecordingDraftHydrationNotice hydrationStatus="ready" onRetry={onRetry} messages={messages} />);
    expect(queryByText(messages.loading)).toBeNull();
    expect(queryByText(messages.error)).toBeNull();
    expect(queryByRole('button', { name: messages.retry })).toBeNull();
  });
});
