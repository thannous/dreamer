/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DreamPulseCard } from '@/components/inspiration/DreamPulseCard';
import type { DreamPulse } from '@/lib/dreamPulse';
import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.default ?? options.web,
    },
    StyleSheet: {
      create: (definitions: Record<string, unknown>) => definitions,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
  };
});

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));

jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: LightTheme, mode: 'light' }),
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string | number>) =>
      replacements ? `${key}|${Object.values(replacements).join(',')}` : key,
  }),
}));

const basePulse: DreamPulse = {
  state: 'steady',
  totalCount: 12,
  analyzedCount: 9,
  favoriteCount: 3,
  lastDreamAt: 1_700_000_000_000,
  daysSinceLastDream: 1,
};

describe('DreamPulseCard', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('shows the loading copy without a CTA while the journal loads', () => {
    render(<DreamPulseCard pulse={null} onPressCta={jest.fn()} />);

    expect(screen.getByText('inspiration.pulse.loading.title')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.InspirationPulseCta)).toBeNull();
    expect(screen.queryByText('inspiration.pulse.metric.total')).toBeNull();
  });

  it('hides the metric row in the empty state but keeps the capture CTA', () => {
    render(
      <DreamPulseCard
        pulse={{
          state: 'empty',
          totalCount: 0,
          analyzedCount: 0,
          favoriteCount: 0,
          lastDreamAt: null,
          daysSinceLastDream: null,
        }}
        onPressCta={jest.fn()}
      />,
    );

    expect(screen.getByText('inspiration.pulse.empty.title')).toBeTruthy();
    expect(screen.queryByText('inspiration.pulse.metric.total')).toBeNull();
    expect(screen.getByTestId(TID.Button.InspirationPulseCta)).toBeTruthy();
  });

  it('renders the journal metrics and reports the state on CTA press', () => {
    const onPressCta = jest.fn();
    render(<DreamPulseCard pulse={basePulse} onPressCta={onPressCta} />);

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('inspiration.pulse.last.yesterday')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.InspirationPulseCta));
    expect(onPressCta).toHaveBeenCalledWith('steady');
  });

  it('formats an older last-capture as a day count', () => {
    render(
      <DreamPulseCard
        pulse={{ ...basePulse, state: 'stale', daysSinceLastDream: 5 }}
        onPressCta={jest.fn()}
      />,
    );

    expect(screen.getByText('inspiration.pulse.last.days|5')).toBeTruthy();
    expect(screen.getByText('inspiration.pulse.stale.title')).toBeTruthy();
  });
});
