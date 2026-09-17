import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CaptureDraftEditor } from '../CaptureDraftEditor';
import { parseCaptureEditableDraft } from '@/lib/captureEditableDraft';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  text: { primary: '#fff', secondary: '#aaa' }, surface: { border: '#444' }, accent: { base: '#ddd' },
}) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));

it('exposes the narrative and answers as inputs but leaves each question read-only', () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const draft = parseCaptureEditableDraft('Une plage.\n\nQuestion : Quelle couleur ?\nRéponse : Noir.');
  const view = render(<CaptureDraftEditor draft={draft} disabled={false} onChange={onChange} onClose={onClose} />);
  expect(view.getByText('Quelle couleur ?')).toBeTruthy();
  expect(view.queryByDisplayValue('Quelle couleur ?')).toBeNull();
  expect(view.getAllByTestId(/capture-adjust-section-/)).toHaveLength(2);
  fireEvent.changeText(view.getByTestId('capture-adjust-section-1'), 'Gris.');
  expect(onChange).toHaveBeenCalledWith(1, 'Gris.');
  fireEvent.press(view.getByTestId('capture-adjust-close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  view.rerender(<CaptureDraftEditor draft={draft} disabled onChange={onChange} onClose={onClose} />);
  expect(view.getByTestId('capture-adjust-section-1').props.editable).toBe(false);
});
