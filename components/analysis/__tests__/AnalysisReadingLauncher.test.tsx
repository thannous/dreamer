import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AnalysisReadingLauncher, type AnalysisReadingHandle } from '../AnalysisReadingLauncher';

jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/motion', () => ({ PressableScale: require('react-native').Pressable }));
jest.mock('../AnalysisReadingModal', () => {
  const { Pressable, Text, View } = require('react-native');
  return ({
  AnalysisReadingModal: ({ onClose }: { onClose: () => void }) => (
    <View testID="reader"><Pressable onPress={onClose}><Text>Close</Text></Pressable></View>
  ),
});
});

it('opens, closes and reopens without rerendering the dream detail owner', async () => {
  const ownerRender = jest.fn();
  const ref = createRef<AnalysisReadingHandle>();
  function Detail() {
    ownerRender();
    return <AnalysisReadingLauncher ref={ref} dream={{ title: 'Dream', interpretation: 'Reading', shareableQuote: '' }} />;
  }
  const view = render(<Detail />);
  const initialRenders = ownerRender.mock.calls.length;
  expect(view.queryByTestId('reader')).toBeNull();
  fireEvent.press(view.getByTestId('analysis.reading.open'));
  expect(view.getByTestId('reader')).toBeTruthy();
  fireEvent.press(view.getByText('Close'));
  expect(view.queryByTestId('reader')).toBeNull();
  await act(async () => ref.current?.open());
  expect(view.getByTestId('reader')).toBeTruthy();
  expect(ownerRender).toHaveBeenCalledTimes(initialRenders);
});
