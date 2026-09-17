/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { StatsRhythmChart } from '@/components/stats/StatsRhythmChart';

jest.mock('react-native', () => {
  const React = require('react');

  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      accessible,
      accessibilityRole,
      accessibilityLabel,
      accessibilityValue,
      accessibilityElementsHidden,
      importantForAccessibility,
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
      ...(accessible === true ? { 'data-accessible': 'true' } : {}),
      ...(accessible === false ? { 'data-accessible': 'false' } : {}),
      ...(accessibilityElementsHidden ? { 'aria-hidden': 'true' } : {}),
      ...(importantForAccessibility ? { 'data-important-for-accessibility': importantForAccessibility } : {}),
      ...(accessibilityValue?.min !== undefined ? { 'aria-valuemin': String(accessibilityValue.min) } : {}),
      ...(accessibilityValue?.max !== undefined ? { 'aria-valuemax': String(accessibilityValue.max) } : {}),
      ...(accessibilityValue?.now !== undefined ? { 'aria-valuenow': String(accessibilityValue.now) } : {}),
      ...(accessibilityValue?.text !== undefined ? { 'aria-valuetext': String(accessibilityValue.text) } : {}),
      ...(style?.height !== undefined ? { 'data-height': String(style.height) } : {}),
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
  { weekday: 1, count: 2, label: 'Mon', countLabel: '2 dreams' },
  { weekday: 2, count: 0, label: 'Tue', countLabel: '0 dreams' },
  { weekday: 3, count: 1, label: 'Wed', countLabel: '1 dream' },
];

describe('StatsRhythmChart', () => {
  it('renders labelled progress bars whose values do not depend on colour', () => {
    render(
      <StatsRhythmChart
        days={DAYS}
        accessibilityLabel="Weekly rhythm"
        testID="trends.week.rhythm"
      />,
    );

    const chart = screen.getByTestId('trends.week.rhythm');
    expect(chart.getAttribute('aria-label')).toBe('Weekly rhythm');
    expect(chart.getAttribute('data-accessible')).toBe('false');
    expect(chart.getAttribute('role')).toBe('none');

    const monday = screen.getByRole('progressbar', { name: 'Mon' });
    expect(monday.getAttribute('data-testid')).toBe('trends.week.rhythm.day.1');
    expect(monday.getAttribute('data-accessible')).toBe('true');
    expect(monday.getAttribute('aria-valuemin')).toBe('0');
    expect(monday.getAttribute('aria-valuemax')).toBe('2');
    expect(monday.getAttribute('aria-valuenow')).toBe('2');
    expect(monday.getAttribute('aria-valuetext')).toBe('2 dreams');
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Tue' }).getAttribute('aria-valuenow')).toBe('0');
    expect(monday.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('shortens the track at 320 dp without dropping a day', () => {
    render(
      <StatsRhythmChart
        days={DAYS}
        compact
        accessibilityLabel="Weekly rhythm"
        testID="trends.week.rhythm"
      />,
    );

    expect(screen.getByTestId('trends.week.rhythm.day.1')).toBeTruthy();
    expect(screen.getByTestId('trends.week.rhythm.day.2')).toBeTruthy();
    expect(screen.getByTestId('trends.week.rhythm.day.3')).toBeTruthy();
    const tracks = screen.getAllByRole('progressbar');
    expect(tracks).toHaveLength(3);
    const heights = Array.from(screen.getByTestId('trends.week.rhythm').querySelectorAll('[data-height]')).map(
      (node) => node.getAttribute('data-height'),
    );
    expect(heights).toEqual(['56', '56', '56']);
  });
});
