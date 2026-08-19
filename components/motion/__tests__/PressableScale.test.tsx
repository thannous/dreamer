import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { PressableScale } from '../PressableScale';

const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockSelectionAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...(args as [])),
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...(args as [])),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

const renderButton = (props: Partial<React.ComponentProps<typeof PressableScale>> = {}) =>
  render(
    <PressableScale testID="target" {...props}>
      <Text>Tap</Text>
    </PressableScale>
  );

describe('PressableScale', () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    mockSelectionAsync.mockClear();
  });

  it('renders its children and commits on press', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = renderButton({ onPress });

    expect(getByText('Tap')).toBeTruthy();
    fireEvent.press(getByTestId('target'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stays silent by default — a haptic on every tap is how users turn haptics off', () => {
    const { getByTestId } = renderButton();

    fireEvent(getByTestId('target'), 'pressIn');

    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('fires the requested haptic on press-in, not on commit', () => {
    const { getByTestId } = renderButton({ haptic: 'light' });

    fireEvent(getByTestId('target'), 'pressIn');
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('target'));
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('does not buzz for a press it will not honour', () => {
    const { getByTestId } = renderButton({ haptic: 'selection', disabled: true });

    fireEvent(getByTestId('target'), 'pressIn');

    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('still forwards the caller onPressIn alongside the haptic', () => {
    const onPressIn = jest.fn();
    const { getByTestId } = renderButton({ haptic: 'medium', onPressIn });

    fireEvent(getByTestId('target'), 'pressIn');

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
  });

  it('survives a rejected haptic — unsupported hardware must not break a tap', () => {
    mockImpactAsync.mockImplementationOnce(() => Promise.reject(new Error('no haptics')));
    const onPress = jest.fn();
    const { getByTestId } = renderButton({ haptic: 'light', onPress });

    expect(() => fireEvent(getByTestId('target'), 'pressIn')).not.toThrow();
    fireEvent.press(getByTestId('target'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
