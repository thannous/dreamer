import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { DURATION, PRESS_SCALE } from '../motion';
import { PressableScale } from '../PressableScale';

const flatten = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {});
  }
  return style as Record<string, unknown>;
};

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

  it('folds caller transitions into the press one instead of replacing it', () => {
    // The whole reason the prop exists: `transitionProperty` is a single declaration, so
    // a caller writing its own into `style` would silently stop the scale from animating.
    const { getByTestId } = renderButton({ transitionProperties: ['borderColor'] });

    const flat = flatten(getByTestId('target').props.style);

    expect(flat.transitionProperty).toEqual(['transform', 'opacity', 'borderColor']);
    // Press feedback and a state colour do not share a duration — one is 120 ms, the
    // other is a state change at 200 ms.
    expect(flat.transitionDuration).toEqual([DURATION.press, DURATION.press, DURATION.fast]);
  });

  it('keeps the caller styles on the element, not behind a style callback', () => {
    // react-native-web drops a function style once Pressable is wrapped in an animated
    // component, taking every caller style with it. The style has to be a plain array.
    const { getByTestId } = renderButton({ style: { borderWidth: 2 } });

    const style = getByTestId('target').props.style;
    expect(typeof style).not.toBe('function');
    expect(flatten(style)).toMatchObject({ borderWidth: 2 });
  });

  it('restores the resting scale when the press ends', () => {
    const { getByTestId } = renderButton();
    const scaleOf = () => {
      const transform = flatten(getByTestId('target').props.style).transform as
        | { scale: number }[]
        | undefined;
      return transform?.[0]?.scale;
    };

    expect(scaleOf()).toBe(1);
    fireEvent(getByTestId('target'), 'pressIn');
    expect(scaleOf()).toBe(PRESS_SCALE);
    fireEvent(getByTestId('target'), 'pressOut');
    expect(scaleOf()).toBe(1);
  });

  it('still forwards the caller onPressOut', () => {
    const onPressOut = jest.fn();
    const { getByTestId } = renderButton({ onPressOut });

    fireEvent(getByTestId('target'), 'pressOut');

    expect(onPressOut).toHaveBeenCalledTimes(1);
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
