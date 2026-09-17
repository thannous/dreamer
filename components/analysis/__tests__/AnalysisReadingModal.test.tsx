import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { AnalysisReadingModal } from '../AnalysisReadingModal';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  return { __esModule: true, default: ({ children, ...props }: any) => React.createElement('Modal', props, children) };
});
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  return { __esModule: true, default: ({ children, ...props }: any) => React.createElement('ScrollView', props, children) };
});

let mockReduced = false;
jest.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => mockReduced }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/motion', () => {
  const { Pressable, View } = require('react-native');
  return { PressableScale: Pressable, Reveal: View };
});

const dream = { title: 'Un nouveau départ', shareableQuote: 'Le voyage commence.', interpretation: 'La gare pourrait évoquer une transition.' };
beforeEach(() => { jest.useFakeTimers(); mockReduced = false; });
afterEach(() => { jest.useRealTimers(); });

it('keeps the quote visible and reveals reading 500 ms after native presentation', async () => {
  const view = render(<AnalysisReadingModal dream={dream} onClose={jest.fn()} />);
  expect(view.getByText('« Le voyage commence. »')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(view.queryByText(dream.interpretation)).toBeNull();
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  await act(async () => { jest.advanceTimersByTime(499); });
  expect(view.queryByText(dream.interpretation)).toBeNull();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(view.getByText(dream.interpretation)).toBeTruthy();
  expect(view.getByText('« Le voyage commence. »')).toBeTruthy();
});

it('supports both the close control and the system back action', () => {
  const onClose = jest.fn();
  const view = render(<AnalysisReadingModal dream={dream} onClose={onClose} />);
  fireEvent.press(view.getByTestId('analysis.reading.close'));
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(onClose).toHaveBeenCalledTimes(2);
});

it.each([true, false])('does not delay accessible reading with reduced motion or no quote: %s', (reduced) => {
  mockReduced = reduced;
  const view = render(<AnalysisReadingModal dream={{ ...dream, shareableQuote: reduced ? dream.shareableQuote : '' }} onClose={jest.fn()} />);
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  expect(view.getByText(dream.interpretation)).toBeTruthy();
});

it('cancels the reveal when closed during the quote', () => {
  const view = render(<AnalysisReadingModal dream={dream} onClose={jest.fn()} />);
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
