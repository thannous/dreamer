import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, View } from 'react-native';

import { RecordingFooter } from '../RecordingFooter';
import { TID } from '@/lib/testIDs';

let mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
jest.mock('react-native', () => {
  const native = require('@jest/globals').jest.requireActual('react-native');
  return Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(native),
    useWindowDimensions: { value: () => mockDimensions, enumerable: true },
  });
});

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: { backgroundCard: '#111', textTertiary: '#aaa' }, mode: 'dark' }),
}));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: { primary: '#dcaf70', primaryBorder: '#eac291', primaryText: '#21180f' },
    surface: { borderStrong: '#555' },
    accent: { text: '#dcaf70' },
    text: { secondary: '#aaa' },
  }),
}));

afterEach(() => {
  mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
});

describe('RecordingFooter', () => {
  it.each(['Enregistrer le rêve', 'Save dream', 'Guardar el sueño'])('preserves the entire visible label and save behavior: %s', (label: string) => {
    mockDimensions = { width: 640, height: 320, scale: 1, fontScale: 2 };
    const onSave = jest.fn();
    const view = render(<RecordingFooter onSave={onSave} isSaveDisabled saveButtonLabel={label} />);
    expect(view.getByText(label).props.children).toBe(label);
    const disabled = view.getByRole('button', { name: label });
    fireEvent.press(disabled);
    expect(onSave).not.toHaveBeenCalled();
    view.rerender(<RecordingFooter onSave={onSave} isSaveDisabled={false} saveButtonLabel={label} />);
    expect(view.getAllByTestId(TID.Button.SaveDream)).toHaveLength(1);
    expect(view.getByText(label).props.children).toBe(label);
    fireEvent.press(view.getByRole('button', { name: label }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it.each([320, 640, 915])('reflows at the measured container width on a %i dp window without limiting text height', (width: number) => {
    mockDimensions = { width, height: 320, scale: 1, fontScale: 2 };
    const view = render(<RecordingFooter onSave={jest.fn()} isSaveDisabled saveButtonLabel="Enregistrer le rêve" saveButtonAccessibilityLabel="Enregistrer le rêve sans analyse" />);
    const container = view.UNSAFE_getAllByType(View).find((node) => typeof node.props.onLayout === 'function');
    expect(container).toBeDefined();
    for (const availableWidth of [width - 32, 288]) {
      fireEvent(container!, 'layout', { nativeEvent: { layout: { width: availableWidth } } });
      const button = view.getByTestId(TID.Button.SaveDream);
      const label = view.getByText('Enregistrer le rêve');
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: Math.min(420, availableWidth), flexShrink: 0 });
      expect(StyleSheet.flatten(button.props.style).height).toBeUndefined();
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({ flexShrink: 0, alignSelf: 'stretch' });
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.maxFontSizeMultiplier).toBeUndefined();
      expect(button.props.accessibilityLabel).toBe('Enregistrer le rêve sans analyse');
    }
  });

  it('offers help as a separate explicit action and disables both choices during saving', () => {
    const onSave = jest.fn();
    const onCompleteWithHelp = jest.fn();
    const props = { onSave, onCompleteWithHelp, saveButtonLabel: 'Save', helpLabel: 'Help', helpHint: 'Saved before continuing' };
    const view = render(<RecordingFooter {...props} isSaveDisabled={false} />);
    fireEvent.press(view.getByTestId('recording-complete-with-help'));
    expect(onCompleteWithHelp).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    view.rerender(<RecordingFooter {...props} isSaveDisabled />);
    fireEvent.press(view.getByTestId('recording-complete-with-help'));
    fireEvent.press(view.getByTestId(TID.Button.SaveDream));
    expect(onCompleteWithHelp).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
