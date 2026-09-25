import { render } from '@testing-library/react-native';
import React from 'react';

import { ProgressFill } from '../ProgressFill';

/**
 * The reanimated stub hands out a fresh shared value per render, so every assertion here
 * is about the first paint — the part a stub can speak to honestly. That the bar then
 * travels, and travels well, is a device question rather than a Jest one.
 */
const flatten = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {});
  }
  return style as Record<string, unknown>;
};

const widthOf = (element: { props: { style?: unknown } }) => flatten(element.props.style).width;

describe('ProgressFill', () => {

  it('clamps values that would run past the track', () => {
    const over = render(<ProgressFill percent={140} growOnMount={false} testID="fill" />);
    expect(widthOf(over.getByTestId('fill'))).toBe('100%');

    const under = render(<ProgressFill percent={-20} growOnMount={false} testID="under" />);
    expect(widthOf(under.getByTestId('under'))).toBe('0%');
  });

  it('survives a percentage that is not a number', () => {
    const { getByTestId } = render(
      <ProgressFill percent={Number.NaN} growOnMount={false} testID="fill" />
    );

    expect(widthOf(getByTestId('fill'))).toBe('0%');
  });
});
