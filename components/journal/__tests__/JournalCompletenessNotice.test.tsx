import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { JournalCompletenessNotice } from '../JournalCompletenessNotice';

jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/motion', () => ({ PressableScale: require('react-native').Pressable }));

it('offers a retry for incomplete content and describes trends scope', () => {
  const onRetry = jest.fn();
  const { getByText, getByRole } = render(<JournalCompletenessNotice status="incomplete" trends onRetry={onRetry} />);
  expect(getByText('journal.completeness.trends')).toBeTruthy();
  fireEvent.press(getByRole('button'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
it('shows loading without a retry and hides when exhaustive', () => {
  const { getByText, queryByRole, queryByText, rerender } = render(<JournalCompletenessNotice status="loading" onRetry={jest.fn()} />);
  expect(getByText('journal.completeness.loading')).toBeTruthy();
  expect(queryByRole('button')).toBeNull();
  rerender(<JournalCompletenessNotice status="complete" onRetry={jest.fn()} />);
  expect(queryByText('journal.completeness.loading')).toBeNull();
});
