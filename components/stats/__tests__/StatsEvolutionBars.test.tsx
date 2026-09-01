/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { StatsEvolutionBars } from '@/components/stats/StatsEvolutionBars';

jest.mock('react-native', () => {
  const React = require('react');

  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      accessible,
      accessibilityRole,
      accessibilityLabel,
      accessibilityValue,
      className,
      style,
      numberOfLines,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessible ? { 'aria-hidden': 'false' } : {}),
      ...(accessibilityValue?.min !== undefined ? { 'aria-valuemin': String(accessibilityValue.min) } : {}),
      ...(accessibilityValue?.max !== undefined ? { 'aria-valuemax': String(accessibilityValue.max) } : {}),
      ...(accessibilityValue?.now !== undefined ? { 'aria-valuenow': String(accessibilityValue.now) } : {}),
      ...(accessibilityValue?.text !== undefined ? { 'aria-valuetext': String(accessibilityValue.text) } : {}),
    };
  };

  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    Platform: { OS: 'web', select: (values: Record<string, any>) => values?.web ?? values?.default },
    Text: createElement('span'),
    View: createElement('div'),
    StyleSheet: { create: <T,>(styles: T) => styles, flatten: (style: any) => style },
  };
});

afterEach(() => {
  cleanup();
});

const DAYS = [
  {
    dateKey: '2026-08-27',
    dateLabel: '27 Aug',
    themeLabel: 'Noir',
    count: 1,
    countLabel: '1 dream',
    accessibilityLabel: '27 Aug: Noir (1)',
  },
  {
    dateKey: '2026-08-28',
    dateLabel: '28 Aug',
    themeLabel: 'Calm',
    count: 3,
    countLabel: '3 dreams',
    accessibilityLabel: '28 Aug: Calm (3)',
  },
];

describe('StatsEvolutionBars', () => {
  it('exposes chronological labelled bars with values independent of colour', () => {
    render(<StatsEvolutionBars days={DAYS} testID="trends.evolution.chart" />);

    const calm = screen.getByRole('progressbar', { name: '28 Aug: Calm (3)' });
    expect(calm.getAttribute('aria-valuenow')).toBe('3');
    expect(calm.getAttribute('aria-valuemax')).toBe('3');
    expect(calm.getAttribute('aria-valuetext')).toBe('3 dreams');
    expect(screen.getByText('28 Aug · Calm')).toBeTruthy();
    expect(screen.getByText('3 dreams')).toBeTruthy();
  });

  it('stacks date, theme and count at 320 dp', () => {
    render(<StatsEvolutionBars days={DAYS} compact testID="trends.evolution.chart" />);

    expect(screen.getByText('28 Aug')).toBeTruthy();
    expect(screen.getByText('Calm')).toBeTruthy();
    expect(screen.queryByText('28 Aug · Calm')).toBeNull();
    expect(screen.getByTestId('trends.evolution.chart.day.2026-08-28')).toBeTruthy();
  });
});
