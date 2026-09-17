import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CaptureReviewPanel } from '../CaptureReviewPanel';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  text: { primary: '#fff', secondary: '#aaa' }, surface: { border: '#444' },
}) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../RecordingTextInput', () => {
  const { TextInput } = require('react-native');
  return { RecordingTextInput: ({ value, onChange, inputTestID, disabled }: any) =>
    <TextInput value={value} onChangeText={onChange} testID={inputTestID} editable={!disabled} /> };
});

it('shows short-answer context separately and edits only the narrator story', () => {
  const onChange = jest.fn();
  const source = 'Une porte.\n\nQuestion : Quelle couleur ?\nRéponse : Bleue.';
  const view = render(<CaptureReviewPanel text={'Une porte.\n\nBleue.'} source={source} disabled={false}
    onChange={onChange} onExit={jest.fn()} />);
  expect(view.getByText('Quelle couleur ?')).toBeTruthy();
  expect(view.getByText('Bleue.')).toBeTruthy();
  expect(view.getByTestId('capture-review-text').props.value).toBe('Une porte.\n\nBleue.');
  fireEvent.changeText(view.getByTestId('capture-review-text'), 'La porte est bleue.');
  expect(onChange).toHaveBeenCalledWith('La porte est bleue.');
  expect(view.getByText('Quelle couleur ?')).toBeTruthy();
});
