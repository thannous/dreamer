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

it('shows answer context separately and edits only the narrator story', () => {
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

it('includes long and multiline answers with every question in their original order', () => {
  const exchanges = [
    ['Quelle couleur ?', 'Bleue.'],
    ['Que voyais-tu ?', 'Je voyais une grande maison au bout du chemin, avec plusieurs fenêtres ouvertes et un jardin rempli de fleurs rouges.'],
    ['Que faisais-tu ?', 'Je marchais vers la maison.\nPuis je suis revenu vers le jardin.'],
  ];
  const source = 'Une maison.' + exchanges.map(([question, answer]) => `\n\nQuestion : ${question}\nRéponse : ${answer}`).join('');
  const view = render(<CaptureReviewPanel text="Mon récit corrigé." source={source} disabled={false}
    onChange={jest.fn()} onExit={jest.fn()} />);
  for (const [question, answer] of exchanges) {
    expect(view.getByText(question)).toBeTruthy();
    expect(view.getByText(answer)).toBeTruthy();
  }
  expect(view.getAllByText(/^(Quelle couleur|Que voyais-tu|Que faisais-tu)/).map(node => node.props.children))
    .toEqual(exchanges.map(([question]) => question));
  expect(view.getByTestId('capture-review-text').props.value).toBe('Mon récit corrigé.');
});
